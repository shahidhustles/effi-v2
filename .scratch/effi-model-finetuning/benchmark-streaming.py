import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

from openai import OpenAI


ROOT = Path(os.environ.get("EFFI_FINETUNE_ROOT", "/content/effi-bench"))
OUTPUT = ROOT / "outputs/streaming-results.json"
MODEL = "effi-qwen3-vl-4b"
client = OpenAI(
    api_key=os.environ["EFFI_MODEL_API_KEY"],
    base_url="http://127.0.0.1:8000/v1",
    timeout=600,
)


def submission_row() -> dict:
    for line in (ROOT / "dataset/effi-training.jsonl").read_text(encoding="utf-8").splitlines():
        row = json.loads(line)
        if row["id"] == "submission_high_en_1":
            return row
    raise RuntimeError("Missing submission_high_en_1 fixture.")


def model_message(message: dict) -> dict:
    converted = {"role": message["role"], "content": message.get("content", "")}
    if message.get("name") is not None:
        converted["name"] = message["name"]
    if message.get("tool_call_id") is not None:
        converted["tool_call_id"] = message["tool_call_id"]
    return converted


row = submission_row()
messages = []
for source_message in row["messages"]:
    if source_message["role"] == "assistant":
        break
    messages.append(model_message(source_message))
started = time.perf_counter()
first_delta_seconds = None
tool_name = ""
arguments = ""
finish_reason = None

stream = client.chat.completions.create(
    model=MODEL,
    messages=messages,
    tools=row["tools"],
    tool_choice="auto",
    temperature=0,
    max_tokens=320,
    stream=True,
)
for chunk in stream:
    elapsed = time.perf_counter() - started
    delta = chunk.choices[0].delta
    if first_delta_seconds is None and (delta.content or delta.tool_calls):
        first_delta_seconds = elapsed
    for call in delta.tool_calls or []:
        if call.function and call.function.name:
            tool_name += call.function.name
        if call.function and call.function.arguments:
            arguments += call.function.arguments
    finish_reason = chunk.choices[0].finish_reason or finish_reason

elapsed = time.perf_counter() - started
parsed_arguments = json.loads(arguments)
results = {
    "recorded_at": datetime.now(timezone.utc).isoformat(),
    "model": MODEL,
    "tool_name": tool_name,
    "arguments": parsed_arguments,
    "finish_reason": finish_reason,
    "first_delta_seconds": round(first_delta_seconds or elapsed, 3),
    "total_seconds": round(elapsed, 3),
    "passed": (
        tool_name == "prepare_submission"
        and parsed_arguments.get("priority", {}).get("priority") == "high"
        and finish_reason == "tool_calls"
    ),
}
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(results, ensure_ascii=False, indent=2))
