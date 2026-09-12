import base64
import json
import mimetypes
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

from openai import OpenAI


ROOT = Path(os.environ.get("EFFI_FINETUNE_ROOT", "/content/effi-bench"))
MODEL = "effi-qwen3-vl-4b"
DATASET = ROOT / "dataset/effi-training.jsonl"
OUTPUT = ROOT / "outputs/serving-results.json"
API_KEY = os.environ["EFFI_MODEL_API_KEY"]
client = OpenAI(api_key=API_KEY, base_url="http://127.0.0.1:8000/v1", timeout=600)


def load_rows() -> dict[str, dict]:
    rows = {}
    for line in DATASET.read_text(encoding="utf-8").splitlines():
        row = json.loads(line)
        rows[row["id"]] = row
    return rows


def image_data_url(relative_path: str) -> str:
    path = ROOT / relative_path
    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{media_type};base64,{encoded}"


def model_message(message: dict) -> dict:
    converted = {"role": message["role"]}
    content = message.get("content")
    if isinstance(content, list):
        parts = []
        for part in content:
            if part["type"] == "image":
                parts.append({"type": "image_url", "image_url": {"url": image_data_url(part["image"])}})
            else:
                parts.append(part)
        converted["content"] = parts
    else:
        converted["content"] = content
    if message.get("name") is not None:
        converted["name"] = message["name"]
    if message.get("tool_call_id") is not None:
        converted["tool_call_id"] = message["tool_call_id"]
    if message.get("tool_calls"):
        converted["tool_calls"] = [
            {
                "id": call["id"],
                "type": "function",
                "function": {
                    "name": call["function"]["name"],
                    "arguments": json.dumps(call["function"]["arguments"], ensure_ascii=False),
                },
            }
            for call in message["tool_calls"]
        ]
    return converted


def generated_message(message) -> dict:
    converted = {"role": "assistant", "content": message.content or ""}
    if message.tool_calls:
        converted["tool_calls"] = [
            {
                "id": call.id,
                "type": "function",
                "function": {"name": call.function.name, "arguments": call.function.arguments},
            }
            for call in message.tool_calls
        ]
    return converted


def completion(messages: list[dict], tools: list[dict]) -> tuple[dict, float, dict]:
    started = time.perf_counter()
    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        tools=tools,
        tool_choice="auto",
        temperature=0,
        max_tokens=320,
    )
    elapsed = time.perf_counter() - started
    usage = response.usage.model_dump() if response.usage else {}
    return generated_message(response.choices[0].message), elapsed, usage


def expected_tool(message: dict) -> str | None:
    calls = message.get("tool_calls") or []
    return calls[0]["function"]["name"] if calls else None


def actual_tool(message: dict) -> tuple[str | None, dict | None, str | None]:
    calls = message.get("tool_calls") or []
    if not calls:
        return None, None, None
    call = calls[0]
    return call["function"]["name"], json.loads(call["function"]["arguments"]), call["id"]


def trajectory(row: dict) -> dict:
    history = []
    checks = []
    last_actual_call_id = None
    for source_message in row["messages"]:
        if source_message["role"] == "assistant":
            generated, elapsed, usage = completion(history, row["tools"])
            expected = expected_tool(source_message)
            actual, arguments, call_id = actual_tool(generated)
            passed = actual == expected if expected else actual is None and bool(generated.get("content", "").strip())
            if actual == "assess_staged_image":
                passed = passed and arguments == {"attachmentId": "att_en_1", "assessment": "satisfactory"}
            if actual == "prepare_submission":
                passed = passed and arguments.get("priority", {}).get("priority") == "high"
                cited = {item.get("sourceMessageId") or item.get("attachmentId") for item in arguments.get("citations", [])}
                passed = passed and bool(cited & {"msg_en_1", "att_en_1"})
            checks.append({
                "expected_tool": expected,
                "actual_tool": actual,
                "arguments": arguments,
                "content": generated.get("content"),
                "latency_seconds": round(elapsed, 3),
                "usage": usage,
                "passed": passed,
            })
            history.append(generated)
            last_actual_call_id = call_id
            continue
        converted = model_message(source_message)
        if converted["role"] == "tool" and last_actual_call_id:
            converted["tool_call_id"] = last_actual_call_id
        history.append(converted)
    return {"row_id": row["id"], "checks": checks, "passed": all(check["passed"] for check in checks)}


def gpu_snapshot() -> dict:
    result = subprocess.run(
        ["nvidia-smi", "--query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu", "--format=csv,noheader,nounits"],
        check=True,
        capture_output=True,
        text=True,
    )
    name, total, used, free, utilization = [part.strip() for part in result.stdout.strip().split(",")]
    return {
        "name": name,
        "memory_total_mib": int(total),
        "memory_used_mib": int(used),
        "memory_free_mib": int(free),
        "utilization_percent": int(utilization),
    }


rows = load_rows()
models = client.models.list()
model_ids = [model.id for model in models.data]
plain_text = trajectory(rows["photo_missing_en_1"])
submission = trajectory(rows["submission_high_en_1"])
image_flow = trajectory(rows["satisfactory_photo_en_1"])
results = {
    "recorded_at": datetime.now(timezone.utc).isoformat(),
    "server": {
        "engine": "vllm",
        "version": "0.26.0",
        "base_model": "Qwen/Qwen3-VL-4B-Instruct",
        "base_revision": "ebb281ec70b05090aa6165b016eac8ec08e71b17",
        "adapter": "shahidhustles/effi-qwen3-vl-4b-adapter",
        "adapter_model_id": MODEL,
        "max_model_len": 8192,
        "quantization": "bitsandbytes-4bit",
        "model_ids": model_ids,
        "cold_start_seconds": float(os.environ.get("EFFI_SERVER_COLD_START_SECONDS", "0")),
    },
    "gpu": gpu_snapshot(),
    "plain_text": plain_text,
    "submission_tool_call": submission,
    "sequential_image_flow": image_flow,
}
results["passed"] = (
    model_ids.count("effi-qwen3-vl-4b") == 1
    and plain_text["passed"]
    and submission["passed"]
    and image_flow["passed"]
)
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(results, ensure_ascii=False, indent=2))
