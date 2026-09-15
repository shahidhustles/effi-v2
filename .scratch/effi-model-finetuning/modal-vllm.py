import os

import modal

MINUTES = 60
VLLM_PORT = 8000
BASE_MODEL = "Qwen/Qwen3-VL-4B-Instruct"
BASE_REVISION = "ebb281ec70b05090aa6165b016eac8ec08e71b17"
ADAPTER_REPO = "shahidhustles/effi-qwen3-vl-4b-adapter"
WARM_CONTAINERS = int(os.environ.get("EFFI_MODAL_WARM", "0"))

image = modal.Image.from_registry("vllm/vllm-openai:v0.26.0", add_python="3.12").entrypoint([]).env(
    {"VLLM_USE_FLASHINFER_SAMPLER": "0"}
)

hf_cache = modal.Volume.from_name("effi-hf-cache", create_if_missing=True)

app = modal.App("effi-vllm")


@app.function(
    image=image,
    gpu="L40S",
    secrets=[
        modal.Secret.from_name("huggingface"),
        modal.Secret.from_name("effi-model-api-key"),
    ],
    volumes={"/root/.cache/huggingface": hf_cache},
    scaledown_window=2 * MINUTES,
    timeout=10 * MINUTES,
    min_containers=WARM_CONTAINERS,
)
@modal.concurrent(max_inputs=8)
@modal.web_server(port=VLLM_PORT, startup_timeout=10 * MINUTES)
def serve():
    import subprocess

    cmd = [
        "vllm",
        "serve",
        BASE_MODEL,
        "--revision",
        BASE_REVISION,
        "--host",
        "0.0.0.0",
        "--port",
        str(VLLM_PORT),
        "--served-model-name",
        "qwen3-vl-4b-base",
        "--api-key",
        os.environ["EFFI_MODEL_API_KEY"],
        "--dtype",
        "bfloat16",
        "--max-model-len",
        "8192",
        "--gpu-memory-utilization",
        "0.92",
        "--max-num-seqs",
        "8",
        "--limit-mm-per-prompt",
        '{"image":1,"video":1}',
        "--media-io-kwargs",
        '{"video": {"num_frames": 8}}',
        "--enable-lora",
        "--lora-modules",
        f"effi-qwen3-vl-4b={ADAPTER_REPO}",
        "--max-lora-rank",
        "16",
        "--enable-auto-tool-choice",
        "--tool-call-parser",
        "hermes",
    ]
    subprocess.Popen(cmd)
