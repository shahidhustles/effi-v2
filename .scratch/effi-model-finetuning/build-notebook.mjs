import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(root, "effi-qwen3-vl-qlora-setup.ipynb");
const outputPath = join(root, "effi-qwen3-vl-qlora.ipynb");
const source = JSON.parse(readFileSync(sourcePath, "utf8"));

let cellIndex = 0;
const nextCellId = () => `effi-${String(cellIndex++).padStart(2, "0")}`;
const markdown = (text) => ({ cell_type: "markdown", id: nextCellId(), metadata: {}, source: text.split(/(?<=\n)/u) });
const code = (text) => ({ cell_type: "code", id: nextCellId(), execution_count: null, metadata: {}, outputs: [], source: text.split(/(?<=\n)/u) });

source.cells = [
  markdown(`# Effi Qwen3-VL 4B QLoRA training and rehearsal

This notebook runs one explicit mode per fresh process: \`setup\`, \`smoke\`, \`train\`, \`refine\`, or \`inference\`. Configure the mode and non-secret repository ID through environment variables. Supply \`HF_TOKEN\` through Colab Secrets or the process environment. The notebook never prints it.
`),
  code(`from pathlib import Path
import gc, hashlib, json, os, platform, re, shutil, subprocess, sys

MODEL_ID = "Qwen/Qwen3-VL-4B-Instruct"
MODEL_REVISION = "ebb281ec70b05090aa6165b016eac8ec08e71b17"
RUN_MODE = os.environ.get("EFFI_RUN_MODE", "setup")
ALLOWED_RUN_MODES = {"setup", "smoke", "train", "refine", "inference"}
MAX_IMAGE_SIDE = 448
SEED = 3407

if RUN_MODE not in ALLOWED_RUN_MODES:
    raise ValueError(f"EFFI_RUN_MODE must be one of {sorted(ALLOWED_RUN_MODES)}, received {RUN_MODE!r}")

candidates = [Path(os.environ["EFFI_FINETUNE_ROOT"])] if os.environ.get("EFFI_FINETUNE_ROOT") else []
candidates += [Path.cwd(), Path("/content/effi-model-finetuning")]
ROOT = next((path for path in candidates if (path / "dataset/effi-training.jsonl").exists()), None)
if ROOT is None:
    raise FileNotFoundError("Could not find dataset/effi-training.jsonl. Set EFFI_FINETUNE_ROOT to the transferred directory.")

DATASET_PATH = ROOT / "dataset/effi-training.jsonl"
MANIFEST_PATH = ROOT / "dataset/manifest.jsonl"
OUTPUT_DIR = ROOT / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
print({"python": sys.version, "platform": platform.platform(), "root": str(ROOT), "run_mode": RUN_MODE, "model_revision": MODEL_REVISION})
`),
  markdown(`## Inspect the assigned accelerator
`),
  code(`gpu_report = subprocess.run(
    ["nvidia-smi", "--query-gpu=name,memory.total,memory.free,driver_version", "--format=csv,noheader"],
    capture_output=True,
    text=True,
    check=True,
).stdout.strip()
print(gpu_report)
if "T4" not in gpu_report:
    raise RuntimeError(f"Expected a T4 for the first run, received: {gpu_report}")
`),
  markdown(`## Install the pinned stack
`),
  code(`install = [
    sys.executable, "-m", "pip", "install", "-q",
    "unsloth==2026.9.4",
    "unsloth_zoo==2026.9.3",
    "transformers==4.57.1",
    "trl==0.22.2",
    "datasets==4.3.0",
    "bitsandbytes==0.50.2",
    "accelerate==1.15.0",
    "peft==0.20.0",
    "sentencepiece==0.2.2",
    "protobuf==7.36.1",
    "torch==2.11.0",
    "torchvision==0.26.0",
    "xformers==0.0.35",
    "triton==3.6.0",
    "pillow==11.3.0",
    "huggingface_hub==0.36.2",
]
subprocess.run(install, check=True)
print("Pinned packages installed.")
`),
  markdown(`## Private repository and durable checkpoint boundary
`),
  code(`from huggingface_hub import HfApi, create_repo, snapshot_download

HF_REPO_ID = os.environ.get("EFFI_HF_REPO_ID")
DURABLE_CHECKPOINT_DIR = os.environ.get("EFFI_DURABLE_CHECKPOINT_DIR")

def load_hf_token():
    token = os.environ.get("HF_TOKEN")
    if token:
        return token
    try:
        from google.colab import userdata
        token = userdata.get("HF_TOKEN")
    except Exception as error:
        raise RuntimeError("HF_TOKEN is unavailable. Add it to Colab Secrets or the process environment.") from error
    if not token:
        raise RuntimeError("HF_TOKEN is empty.")
    os.environ["HF_TOKEN"] = token
    return token

requires_hub = RUN_MODE in {"smoke", "train", "refine", "inference"}
if requires_hub:
    if not HF_REPO_ID or not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", HF_REPO_ID):
        raise RuntimeError("Set EFFI_HF_REPO_ID to the private destination in owner/repo form.")
    load_hf_token()

if RUN_MODE in {"smoke", "train", "refine"}:
    checkpoint_prefix = "refinement-checkpoints" if RUN_MODE == "refine" else "training-checkpoints"
    expected_durable_uri = f"hf://{HF_REPO_ID}/{checkpoint_prefix}"
    if DURABLE_CHECKPOINT_DIR != expected_durable_uri:
        raise RuntimeError(f"Set EFFI_DURABLE_CHECKPOINT_DIR exactly to {expected_durable_uri!r}.")
    create_repo(repo_id=HF_REPO_ID, repo_type="model", private=True, exist_ok=True)
    repo_info = HfApi().repo_info(repo_id=HF_REPO_ID, repo_type="model")
    if not repo_info.private:
        raise RuntimeError("The Hugging Face destination must be private before training starts.")

TRAIN_OUTPUT_DIR = OUTPUT_DIR / ("smoke" if RUN_MODE == "smoke" else "refinement" if RUN_MODE == "refine" else "training")
TRAIN_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
print({"repo_configured": bool(HF_REPO_ID), "private_repo_checked": RUN_MODE in {"smoke", "train", "refine"}, "durable_checkpoint_uri": DURABLE_CHECKPOINT_DIR})
`),
  markdown(`## Load and verify the sanitized dataset
`),
  code(`from datasets import Dataset

def read_jsonl(path):
    with path.open(encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]

rows = read_jsonl(DATASET_PATH)
manifest = read_jsonl(MANIFEST_PATH)
assert 500 <= len(rows) <= 1000
assert len(rows) == len(manifest)
assert all(row["model"]["revision"] == MODEL_REVISION for row in rows)
assert all(row["loss_policy"] == "assistant_messages_only" for row in rows)
assert all(entry["sanitization_status"] == "passed" for entry in manifest)
assert max(
    sum(
        1
        for message in row["messages"]
        if isinstance(message.get("content"), list)
        for part in message["content"]
        if part.get("type") == "image"
    )
    for row in rows
) <= 1
for row, entry in zip(rows, manifest):
    digest = hashlib.sha256(json.dumps(row, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    assert entry["row_id"] == row["id"] and entry["sha256"] == digest

train_dataset = Dataset.from_dict({"payload": [json.dumps(row, ensure_ascii=False) for row in rows]})
print({
    "rows": len(rows),
    "languages": {language: sum(row["language"] == language for row in rows) for language in ("en", "hi", "hinglish")},
    "families": len(set(row["scenario_family"] for row in rows)),
})
`),
  markdown(`## Load the pinned 4-bit base and adapter when needed
`),
  code(`import torch
from huggingface_hub import model_info
from unsloth import FastVisionModel

for stale_name in ("model", "trainer", "batch", "output", "device_batch"):
    globals().pop(stale_name, None)
gc.collect()
torch.cuda.empty_cache()
assert torch.cuda.is_available()
resolved_revision = model_info(MODEL_ID, revision=MODEL_REVISION).sha
assert resolved_revision == MODEL_REVISION

model, processor = FastVisionModel.from_pretrained(
    model_name=MODEL_ID,
    revision=MODEL_REVISION,
    use_exact_model_name=True,
    load_in_4bit=True,
    use_gradient_checkpointing="unsloth" if RUN_MODE != "inference" else False,
)

if RUN_MODE in {"inference", "refine"}:
    from peft import PeftModel
    adapter_snapshot = Path(snapshot_download(
        repo_id=HF_REPO_ID,
        repo_type="model",
        ignore_patterns=["training-checkpoints/*", "smoke/*"],
    ))
    metadata = json.loads((adapter_snapshot / "effi-model-metadata.json").read_text(encoding="utf-8"))
    if metadata["model_revision"] != MODEL_REVISION:
        raise RuntimeError("Exported adapter metadata does not match the pinned base revision.")
    model = PeftModel.from_pretrained(model, adapter_snapshot, is_trainable=RUN_MODE == "refine")
    if RUN_MODE == "inference":
        FastVisionModel.for_inference(model)
    print({"adapter_snapshot": str(adapter_snapshot), "fresh_process_reload": RUN_MODE == "inference", "adapter_trainable": RUN_MODE == "refine"})
else:
    model = FastVisionModel.get_peft_model(
        model,
        finetune_vision_layers=False,
        finetune_language_layers=True,
        finetune_attention_modules=True,
        finetune_mlp_modules=True,
        r=16,
        lora_alpha=16,
        lora_dropout=0,
        bias="none",
        random_state=SEED,
        use_rslora=False,
        loftq_config=None,
    )
    vision_trainable = [name for name, parameter in model.named_parameters() if parameter.requires_grad and ("visual" in name or "vision" in name)]
    if vision_trainable:
        raise RuntimeError(f"Vision parameters unexpectedly trainable: {vision_trainable[:5]}")
    print({"trainable_parameters": sum(parameter.numel() for parameter in model.parameters() if parameter.requires_grad), "vision_trainable_parameters": 0})
`),
  markdown(`## Vision-aware assistant-only collator
`),
  code(`from copy import deepcopy
from PIL import Image

def capped_rgb_image(path):
    image = Image.open(path).convert("RGB")
    image.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE), Image.Resampling.LANCZOS)
    return image.copy()

def materialize_images(messages):
    materialized = deepcopy(messages)
    image_count = 0
    for message in materialized:
        if isinstance(message.get("content"), str):
            text = message["content"]
            message["content"] = [] if text == "" else [{"type": "text", "text": text}]
        for part in message["content"]:
            if part.get("type") != "image":
                continue
            image_count += 1
            image_path = (ROOT / part["image"]).resolve()
            if ROOT.resolve() not in image_path.parents:
                raise ValueError(f"Image escaped notebook root: {image_path}")
            part["image"] = capped_rgb_image(image_path)
    if image_count > 1:
        raise ValueError("Each row may contain at most one image.")
    return materialized

class EffiVisionAssistantCollator:
    def __init__(self, processor):
        self.processor = processor

    def encode(self, messages, tools, add_generation_prompt=False):
        encoded = self.processor.apply_chat_template(
            messages,
            tools=tools,
            tokenize=True,
            add_generation_prompt=add_generation_prompt,
            return_dict=True,
            return_tensors="pt",
        )
        encoded.pop("token_type_ids", None)
        return encoded

    def __call__(self, features):
        if len(features) != 1:
            raise ValueError("The T4-safe configuration requires per_device_train_batch_size=1.")
        feature = json.loads(features[0]["payload"])
        messages = materialize_images(feature["messages"])
        tools = feature["tools"]
        encoded = self.encode(messages, tools)
        labels = torch.full_like(encoded["input_ids"], -100)
        for index, message in enumerate(messages):
            if message["role"] != "assistant":
                continue
            before = self.encode(messages[:index], tools)["input_ids"].shape[-1]
            through = self.encode(messages[: index + 1], tools)["input_ids"].shape[-1]
            labels[:, before:through] = encoded["input_ids"][:, before:through]
        if not torch.any(labels != -100):
            raise ValueError("No assistant tokens were selected for loss.")
        encoded["labels"] = labels
        return encoded

collator = EffiVisionAssistantCollator(processor)
representative_index = next(index for index, row in enumerate(rows) if row["id"] == "satisfactory_photo_en_1")
if RUN_MODE != "inference":
    batch = collator([train_dataset[representative_index]])
    print({key: list(value.shape) for key, value in batch.items() if hasattr(value, "shape")})
    print({"assistant_target_tokens": int((batch["labels"] != -100).sum()), "total_tokens": int(batch["labels"].numel())})
`),
  markdown(`## Configure checkpoints and trainer
`),
  code(`from importlib.metadata import version

PACKAGES = ["torch", "torchvision", "unsloth", "unsloth_zoo", "transformers", "trl", "datasets", "bitsandbytes", "accelerate", "peft", "pillow", "huggingface_hub"]
resolved_versions = {package: version(package) for package in PACKAGES}

if RUN_MODE in {"setup", "smoke", "train", "refine"}:
    from transformers import TrainerCallback
    from trl import SFTConfig, SFTTrainer

    class DurableHubCheckpointCallback(TrainerCallback):
        def on_save(self, args, state, control, **kwargs):
            checkpoint = Path(args.output_dir) / f"checkpoint-{state.global_step}"
            if checkpoint.exists() and RUN_MODE in {"smoke", "train", "refine"}:
                prefix = "smoke/checkpoints" if RUN_MODE == "smoke" else "refinement-checkpoints" if RUN_MODE == "refine" else "training-checkpoints"
                HfApi().upload_folder(
                    repo_id=HF_REPO_ID,
                    repo_type="model",
                    folder_path=checkpoint,
                    path_in_repo=f"{prefix}/{checkpoint.name}",
                    commit_message=f"Save {RUN_MODE} checkpoint {state.global_step}",
                )
            return control

    def latest_durable_checkpoint():
        if RUN_MODE not in {"train", "refine"}:
            return None
        files = HfApi().list_repo_files(repo_id=HF_REPO_ID, repo_type="model")
        prefix = "refinement-checkpoints" if RUN_MODE == "refine" else "training-checkpoints"
        steps = sorted({int(match.group(1)) for path in files if (match := re.match(rf"{prefix}/checkpoint-(\\d+)/", path))})
        if not steps:
            return None
        step = steps[-1]
        local_root = OUTPUT_DIR / "restored-checkpoints"
        snapshot_download(
            repo_id=HF_REPO_ID,
            repo_type="model",
            allow_patterns=[f"{prefix}/checkpoint-{step}/*"],
            local_dir=local_root,
        )
        checkpoint = local_root / prefix / f"checkpoint-{step}"
        if not (checkpoint / "trainer_state.json").exists():
            raise RuntimeError(f"Durable checkpoint {step} is incomplete.")
        return str(checkpoint)

    trainer_dataset = train_dataset.select(range(min(8, len(train_dataset)))) if RUN_MODE == "smoke" else train_dataset
    training_kwargs = {
        "output_dir": str(TRAIN_OUTPUT_DIR),
        "per_device_train_batch_size": 1,
        "gradient_accumulation_steps": 8,
        "gradient_checkpointing": True,
        "fp16": True,
        "bf16": False,
        "learning_rate": 2e-4,
        "warmup_ratio": 0.03,
        "logging_steps": 1,
        "save_strategy": "steps",
        "save_steps": 1 if RUN_MODE == "smoke" else 25,
        "save_total_limit": 3,
        "optim": "adamw_8bit",
        "weight_decay": 0.001,
        "lr_scheduler_type": "linear",
        "seed": SEED,
        "report_to": "none",
        "remove_unused_columns": False,
        "dataset_text_field": "",
        "dataset_kwargs": {"skip_prepare_dataset": True},
        "max_length": None,
    }
    if RUN_MODE == "smoke":
        training_kwargs["max_steps"] = 1
    else:
        training_kwargs["num_train_epochs"] = 1

    FastVisionModel.for_training(model)
    training_args = SFTConfig(**training_kwargs)
    trainer = SFTTrainer(
        model=model,
        tokenizer=processor,
        data_collator=collator,
        train_dataset=trainer_dataset,
        args=training_args,
        callbacks=[DurableHubCheckpointCallback()],
    )
    print({"trainer_rows": len(trainer_dataset), "mode": RUN_MODE, "checkpoint_steps": training_args.save_steps})
`),
  markdown(`## Run setup, smoke, train, or one corrective epoch
`),
  code(`run_result = {"run_mode": RUN_MODE, "model_id": MODEL_ID, "model_revision": MODEL_REVISION, "dataset_rows": len(rows), "versions": resolved_versions}

if RUN_MODE == "setup":
    device_batch = {key: value.to("cuda") if hasattr(value, "to") else value for key, value in batch.items()}
    with torch.no_grad():
        output = model(**device_batch)
    loss = float(output.loss.detach().cpu())
    if not torch.isfinite(output.loss):
        raise RuntimeError(f"Non-finite setup loss: {loss}")
    run_result.update({"setup_forward_loss": loss, "training_updates": 0})

if RUN_MODE in {"smoke", "train", "refine"}:
    resume_checkpoint = latest_durable_checkpoint()
    train_output = trainer.train(resume_from_checkpoint=resume_checkpoint)
    run_result.update({
        "resume_checkpoint": resume_checkpoint,
        "global_step": trainer.state.global_step,
        "train_loss": train_output.training_loss,
        "epoch": trainer.state.epoch,
    })

    export_subdir = "smoke/adapter" if RUN_MODE == "smoke" else None
    export_dir = OUTPUT_DIR / ("smoke-adapter" if RUN_MODE == "smoke" else "final-adapter")
    if export_dir.exists():
        shutil.rmtree(export_dir)
    export_dir.mkdir(parents=True)
    model.save_pretrained(export_dir)
    processor.save_pretrained(export_dir)
    if getattr(model, "generation_config", None) is not None:
        model.generation_config.save_pretrained(export_dir)
    shutil.copy2(MANIFEST_PATH, export_dir / "dataset-manifest.jsonl")
    metadata = {
        "model_id": MODEL_ID,
        "model_revision": MODEL_REVISION,
        "dataset_rows": len(rows),
        "dataset_sha256": hashlib.sha256(DATASET_PATH.read_bytes()).hexdigest(),
        "manifest_sha256": hashlib.sha256(MANIFEST_PATH.read_bytes()).hexdigest(),
        "loss_policy": "assistant_messages_only",
        "vision_encoder_frozen": True,
        "versions": resolved_versions,
        "run_mode": RUN_MODE,
    }
    (export_dir / "effi-model-metadata.json").write_text(json.dumps(metadata, indent=2) + "\\n", encoding="utf-8")
    (export_dir / "README.md").write_text(
        "# Effi Qwen3-VL 4B adapter\\n\\nPrivate QLoRA adapter for the sanitized Effi civic-reporting rehearsal dataset. The base revision and package versions are recorded in effi-model-metadata.json.\\n",
        encoding="utf-8",
    )
    adapter_files = list(export_dir.glob("*.safetensors"))
    if not adapter_files or not all(path.stat().st_size > 0 for path in adapter_files):
        raise RuntimeError("Adapter export did not produce a non-empty safetensors file.")
    HfApi().upload_folder(
        repo_id=HF_REPO_ID,
        repo_type="model",
        folder_path=export_dir,
        path_in_repo=export_subdir,
        commit_message=f"Export Effi {RUN_MODE} adapter",
    )
    run_result.update({"export_dir": str(export_dir), "adapter_bytes": sum(path.stat().st_size for path in adapter_files), "hub_path": export_subdir or "/"})

run_result["peak_reserved_gib"] = round(torch.cuda.max_memory_reserved() / 2**30, 2)
result_path = OUTPUT_DIR / f"{RUN_MODE}-result.json"
result_path.write_text(json.dumps(run_result, indent=2) + "\\n", encoding="utf-8")
print(json.dumps(run_result, indent=2))
`),
  markdown(`## Fresh-process inference rehearsals
`),
  code(`def extract_tool_call(text):
    match = re.search(r"<tool_call>\\s*(.*?)\\s*</tool_call>", text, re.DOTALL)
    if not match:
        return None
    payload = json.loads(match.group(1))
    if not isinstance(payload, dict) or not isinstance(payload.get("name"), str) or not isinstance(payload.get("arguments"), dict):
        raise ValueError(f"Malformed tool call: {payload!r}")
    return payload

def valid_generated_call(call, expected_tool, row):
    if not call or call["name"] != expected_tool:
        return False
    arguments = call["arguments"]
    if expected_tool == "assess_staged_image":
        return arguments.get("attachmentId") in row["known_attachment_ids"] and arguments.get("assessment") in {"satisfactory", "insufficient"}
    if expected_tool == "record_report_interpretation":
        return isinstance(arguments.get("issue"), str) and bool(arguments["issue"].strip()) and arguments.get("category") in {"roads", "sanitation", "water", "lighting", "drainage", "other"}
    if expected_tool == "ask_question":
        options = arguments.get("options")
        return (
            isinstance(arguments.get("prompt"), str)
            and bool(arguments["prompt"].strip())
            and isinstance(options, list)
            and [option.get("id") for option in options if isinstance(option, dict)] == ["confirm", "edit"]
        )
    if expected_tool == "prepare_submission":
        priority = arguments.get("priority")
        citations = arguments.get("citations")
        valid_sources = set(row["known_source_message_ids"])
        valid_attachments = set(row["initial_state"]["acceptedAttachmentIds"])
        return (
            isinstance(arguments.get("summary"), str)
            and arguments.get("category") in {"roads", "sanitation", "water", "lighting", "drainage", "other"}
            and isinstance(priority, dict)
            and priority.get("priority") == row["priority_label"]
            and isinstance(priority.get("reasons"), list)
            and bool(priority["reasons"])
            and isinstance(citations, list)
            and bool(citations)
            and all(
                citation.get("sourceMessageId") in valid_sources
                if citation.get("kind") == "transcript_message"
                else citation.get("attachmentId") in valid_attachments
                if citation.get("kind") == "accepted_evidence"
                else False
                for citation in citations
                if isinstance(citation, dict)
            )
        )
    return False

def generate_assistant(messages, tools):
    encoded = collator.encode(materialize_images(messages), tools, add_generation_prompt=True)
    encoded = {key: value.to("cuda") if hasattr(value, "to") else value for key, value in encoded.items()}
    input_tokens = encoded["input_ids"].shape[-1]
    with torch.no_grad():
        generated = model.generate(**encoded, max_new_tokens=512, do_sample=False, use_cache=True)
    return processor.decode(generated[0][input_tokens:], skip_special_tokens=False).strip()

def rehearsal(row_id, user_override=None):
    row = next(item for item in rows if item["id"] == row_id)
    messages = deepcopy(row["messages"][:2])
    if user_override is not None:
        if isinstance(messages[1]["content"], list):
            text_part = next(part for part in messages[1]["content"] if part["type"] == "text")
            text_part["text"] = user_override
        else:
            messages[1]["content"] = user_override
    checks = []
    index = 2
    while index < len(row["messages"]):
        expected = row["messages"][index]
        if expected["role"] != "assistant":
            messages.append(deepcopy(expected))
            index += 1
            continue
        raw = generate_assistant(messages, row["tools"])
        expected_tool = expected.get("tool_calls", [{}])[0].get("function", {}).get("name") if expected.get("tool_calls") else None
        actual_call = extract_tool_call(raw)
        actual_tool = actual_call["name"] if actual_call else None
        if expected_tool:
            passed = valid_generated_call(actual_call, expected_tool, row)
        else:
            language_ok = row["language"] != "hi" or bool(re.search(r"[\u0900-\u097F]", raw))
            passed = actual_call is None and bool(raw) and language_ok
        checks.append({"expected_tool": expected_tool, "actual_tool": actual_tool, "actual_arguments": actual_call["arguments"] if actual_call else None, "arguments_valid": passed if expected_tool else None, "passed": passed, "raw": raw})
        messages.append(deepcopy(expected))
        index += 1
    return {"row_id": row_id, "language": row["language"], "priority_label": row["priority_label"], "checks": checks, "passed": all(check["passed"] for check in checks)}

if RUN_MODE == "inference":
    rehearsals = [
        rehearsal("satisfactory_photo_en_1", "There is a deep pothole outside the main entrance of City Hospital. Vehicles are swerving suddenly to avoid it and two bike riders have already fallen."),
        rehearsal("submission_high_en_1"),
        rehearsal("drainage_photo_hi_1", "हमारे स्कूल के सामने नाली पूरी तरह बंद है और गंदा पानी सड़क पर भर रहा है। बच्चों को उसी पानी से होकर स्कूल जाना पड़ रहा है।"),
        rehearsal("photo_missing_en_1", "There is garbage everywhere near our building."),
        rehearsal("bad_photo_en_1", "A streetlight has fallen and exposed wires are lying beside the road."),
        rehearsal("replacement_photo_en_1"),
        rehearsal("correction_en_1", "The location is correct, but this is sewage leaking from a broken drain, not a clean water pipe."),
        rehearsal("lighting_medium_photo_hi_1", "हमारे इलाके में तीन दिन से स्ट्रीट लाइट बंद है। रात में पूरा रास्ता अंधेरा रहता है और लोगों को आने जाने में परेशानी हो रही है।"),
        rehearsal("submission_high_en_2"),
        rehearsal("submission_high_en_3"),
    ]
    priority_pair = [item for item in rehearsals if item["row_id"] in {"submission_high_en_2", "submission_high_en_3"}]
    generated_pair_priorities = [
        check["actual_arguments"].get("priority", {}).get("priority")
        for item in priority_pair
        for check in item["checks"]
        if check["expected_tool"] == "prepare_submission" and isinstance(check["actual_arguments"], dict)
    ]
    inference_result = {
        "fresh_process_reload": True,
        "hf_repo_id": HF_REPO_ID,
        "adapter_snapshot": str(adapter_snapshot),
        "adapter_bytes": sum(path.stat().st_size for path in adapter_snapshot.glob("*.safetensors")),
        "model_revision": MODEL_REVISION,
        "rehearsal_conditioning": "Each decision is checked against the correct prior tool result so one malformed step cannot hide later capabilities.",
        "rehearsals": rehearsals,
        "same_facts_priority_stable": len(generated_pair_priorities) == 2 and len(set(generated_pair_priorities)) == 1 and generated_pair_priorities[0] == "high",
        "all_expected_response_types_passed": all(item["passed"] for item in rehearsals),
    }
    inference_path = OUTPUT_DIR / "inference-results.json"
    inference_path.write_text(json.dumps(inference_result, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
    print(json.dumps({"inference_results": str(inference_path), "all_expected_response_types_passed": inference_result["all_expected_response_types_passed"]}, indent=2))
else:
    print("Inference rehearsals skipped in this process.")
`),
  markdown(`## Release process memory
`),
  code(`for stale_name in ("trainer", "model", "batch", "output", "device_batch"):
    globals().pop(stale_name, None)
gc.collect()
torch.cuda.empty_cache()
print("Process artifacts are written under outputs. Recover them before releasing the Colab runtime.")
`),
];

source.metadata = {
  ...source.metadata,
  effi: {
    model_id: "Qwen/Qwen3-VL-4B-Instruct",
    model_revision: "ebb281ec70b05090aa6165b016eac8ec08e71b17",
    dataset: "dataset/effi-training.jsonl",
    run_modes: ["setup", "smoke", "train", "inference"],
  },
};

writeFileSync(outputPath, `${JSON.stringify(source, null, 1)}\n`, "utf8");
console.log(outputPath);
