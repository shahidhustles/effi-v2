import os


required_environment = (
    "EFFI_MODEL_API_KEY",
    "HF_TOKEN",
)
missing = [name for name in required_environment if not os.environ.get(name)]
if missing:
    raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")

arguments = [
    "vllm",
    "serve",
    "Qwen/Qwen3-VL-4B-Instruct",
    "--revision",
    "ebb281ec70b05090aa6165b016eac8ec08e71b17",
    "--host",
    "0.0.0.0",
    "--port",
    "8000",
    "--served-model-name",
    "qwen3-vl-4b-base",
    "--api-key",
    os.environ["EFFI_MODEL_API_KEY"],
    "--dtype",
    "half",
    "--quantization",
    "bitsandbytes",
    "--max-model-len",
    "8192",
    "--gpu-memory-utilization",
    "0.90",
    "--max-num-seqs",
    "1",
    "--limit-mm-per-prompt",
    '{"image":1,"video":0}',
    "--enable-lora",
    "--lora-modules",
    "effi-qwen3-vl-4b=shahidhustles/effi-qwen3-vl-4b-adapter",
    "--max-lora-rank",
    "16",
    "--enable-auto-tool-choice",
    "--tool-call-parser",
    "hermes",
    "--enforce-eager",
]

os.execvp(arguments[0], arguments)
