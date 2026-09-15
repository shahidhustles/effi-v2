# Effi adapter training runbook

## Local preparation

From the repository root:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .scratch/effi-model-finetuning/build-dataset.ts
pnpm --filter @effi/bot-setup exec tsc --ignoreConfig --noEmit --allowImportingTsExtensions --module esnext --moduleResolution bundler --target es2022 --types node --skipLibCheck ../../.scratch/effi-model-finetuning/build-dataset.ts
node .scratch/effi-model-finetuning/build-notebook.mjs
```

The generator must produce 792 rows and matching manifest hashes. `build-notebook.mjs` creates the disposable local notebook `effi-qwen3-vl-qlora.ipynb`; generated notebooks are not committed.

## Colab inputs

After generating them locally, transfer only these paths to `/content/effi-model-finetuning`:

- `effi-qwen3-vl-qlora.ipynb`
- `dataset/effi-training.jsonl`
- `dataset/manifest.jsonl`
- `dataset/summary.json`
- `images/*.png`

Use a Tesla T4. Confirm the assigned GPU and free VRAM before model loading.

Set these non-secret environment values:

```text
EFFI_FINETUNE_ROOT=/content/effi-model-finetuning
EFFI_HF_REPO_ID=shahidhustles/effi-qwen3-vl-4b-adapter
EFFI_DURABLE_CHECKPOINT_DIR=hf://shahidhustles/effi-qwen3-vl-4b-adapter/training-checkpoints
```

Supply `HF_TOKEN` through Colab Secrets or the process environment. Do not add it to this file, the notebook, a command, or a log.

## Run modes

Execute the notebook in a fresh process for each mode by setting `EFFI_RUN_MODE`:

1. `setup` loads the pinned 4-bit base, verifies the frozen vision encoder and collator, and runs one no-update forward pass.
2. `smoke` performs one optimizer update, uploads a resumable checkpoint under `smoke/checkpoints/`, and exports a smoke adapter under `smoke/adapter/`.
3. `train` restores the latest `training-checkpoints/checkpoint-*` directory when present, runs one complete epoch, uploads checkpoints at steps 25, 50, and 75, and exports the final adapter at the repository root.
4. `refine` reloads the exported adapter as trainable, restores the latest `refinement-checkpoints/checkpoint-*` directory when present, runs one corrective epoch, and replaces the repository-root adapter. Set `EFFI_DURABLE_CHECKPOINT_DIR` to `hf://shahidhustles/effi-qwen3-vl-4b-adapter/refinement-checkpoints` for this mode.
5. `inference` starts a fresh process, reloads the pinned 4-bit base plus the exported adapter, and writes fixed rehearsal results to `outputs/inference-results.json`.

Do not run a second epoch unless the fixed rehearsals fail and the failure is recorded first.

## Recovery

If Colab replaces or reclaims the runtime:

1. Start a fresh named T4 session.
2. Transfer the clean notebook, sanitized dataset, manifest, summary, and synthetic images again.
3. Restore the same three environment values and `HF_TOKEN`.
4. Run the interrupted mode. `train` restores from `training-checkpoints`; `refine` restores from `refinement-checkpoints`.

Never treat a quiet process as failed. Check process status, GPU use, CPU use, disk activity, and the private checkpoint path before considering an interruption.

## Artifact recovery and shutdown

Before releasing the runtime, recover:

- the executed setup, smoke, training, and inference notebooks
- `outputs/setup-result.json`
- `outputs/smoke-result.json`
- `outputs/train-result.json`
- `outputs/refine-result.json`, when a corrective epoch was required
- `outputs/inference-results.json`
- any failure notebook and process output needed for diagnosis

Confirm the private repository contains the final non-empty adapter and metadata. Then pause or stop the named Colab session. `/content` is disposable after release.

## T4 inference server

Use a fresh T4 runtime. Transfer `start-vllm.py`, `benchmark-vllm.py`, `benchmark-streaming.py`, the dataset, and the one synthetic benchmark image to `/content/effi-bench`.

Install the serving dependencies:

```bash
python -m pip install vllm==0.26.0 bitsandbytes==0.50.2
```

Supply `HF_TOKEN` and a temporary `EFFI_MODEL_API_KEY` through the process environment. Do not put either value in this runbook or a notebook cell. On the tested Colab image, start the server with:

```bash
export CUDA_HOME=/usr/local/cuda-12.8
export LD_LIBRARY_PATH=/usr/lib64-nvidia:/usr/local/cuda-12.8/lib64:/usr/local/lib/python3.13/dist-packages/nvidia/cu13/lib:/usr/local/lib/python3.13/dist-packages/torch/lib
export VLLM_USE_FLASHINFER_SAMPLER=0
python /content/effi-bench/start-vllm.py
```

Wait for `Starting vLLM server on http://0.0.0.0:8000`. A fresh uncached start took 313 seconds. A cached restart took about 140 seconds.

`start-vllm.py` keeps the base and adapter as separate model IDs. The gateway must use `effi-qwen3-vl-4b`. Keep `--tool-call-parser hermes`: the adapter emits `<tool_call>...</tool_call>`, which Hermes converted into the OpenAI tool-call shape. The Qwen3 XML parser left those calls in message content during this run.

Run the fixed serving and streaming checks:

```bash
python /content/effi-bench/benchmark-vllm.py
python /content/effi-bench/benchmark-streaming.py
```

Both scripts require `EFFI_MODEL_API_KEY`; also set `EFFI_FINETUNE_ROOT=/content/effi-bench`. Recover `outputs/serving-results.json` and `outputs/streaming-results.json` before releasing the runtime.

## Modal serving (L40S)

The Colab T4 server and the temporary tunnel are replaced by a Modal app. The app definition is `modal-vllm.py` in this directory. It serves the pinned base revision in bfloat16 with the unmerged adapter, the Hermes tool-call parser, and CUDA graphs enabled on an L40S. The T4-only settings `--quantization bitsandbytes` and `--enforce-eager` are dropped. Video input is enabled with `--limit-mm-per-prompt '{"image":1,"video":1}'` and capped at eight sampled frames per request through `--media-io-kwargs '{"video": {"num_frames": 8}}'`.

One-time setup:

```bash
uv tool install modal
modal token new

modal secret create huggingface HF_TOKEN=hf_xxx
modal secret create effi-model-api-key EFFI_MODEL_API_KEY=<temporary inference key>
```

Deploy and copy the web endpoint URL from the output:

```bash
modal deploy .scratch/effi-model-finetuning/modal-vllm.py
```

Weights cache in the `effi-hf-cache` volume, so only the first cold start downloads the model. The container stays warm 2 minutes after the last request. For a demo window that must not cold start, deploy with `EFFI_MODAL_WARM=1 modal deploy ...` to hold one warm container, which bills continuously.

Gateway configuration, same values as the tunnel setup with the Modal base URL:

```text
EFFI_MODEL_BASE_URL=https://<workspace>--effi-vllm-serve.modal.run/v1
EFFI_MODEL_API_KEY=<same temporary vLLM API key>
EFFI_MODEL_ID=effi-qwen3-vl-4b
```

Smoke test the endpoint, then run the local provider smoke from the Bot gateway section:

```bash
curl -s https://<workspace>--effi-vllm-serve.modal.run/v1/chat/completions \
  -H "Authorization: Bearer $EFFI_MODEL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"effi-qwen3-vl-4b","messages":[{"role":"user","content":"ping"}],"max_tokens":8}'
```

Logs live in `modal app logs effi-vllm`. `modal app stop effi-vllm` stops all billing. Measured cold start on the L40S is 151 seconds for the first request, including 68.6 seconds of torch.compile. Warm timings land near 1.3 seconds for a missing-photo text reply, 4.0 seconds for an image assessment, and 3.8 seconds for a submission tool call. The torch.compile cache is not persisted, so every container restart pays the compile time again. A volume mounted at `/root/.cache/vllm` would remove that cost.

## Temporary HTTPS tunnel

Superseded by Modal serving. Retained for a Colab-only fallback.

Download `cloudflared` into disposable Colab storage and start an account-less demo tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:8000 --no-autoupdate
```

Use the generated HTTPS origin plus `/v1` as `EFFI_MODEL_BASE_URL`. The vLLM API key remains required through the tunnel. The quick tunnel has no uptime guarantee and is for the live demo only.

## Bot gateway

Configure the local gateway process without writing secrets to Git:

```text
EFFI_MODEL_BASE_URL=https://temporary-tunnel.example/v1
EFFI_MODEL_API_KEY=<same temporary vLLM API key>
EFFI_MODEL_ID=effi-qwen3-vl-4b
```

The agent uses the OpenAI-compatible Chat Completions client at its existing Eve dynamic model boundary. It has no automatic Muse fallback. The citizen message is persisted before the model turn, so a provider failure leaves the draft recoverable.

Before opening the real channels, run the local provider smoke:

```bash
WHATSAPP_CONNECT=0 pnpm --filter @effi/bot-setup exec eve invoke 'There is garbage everywhere near our building.'
```

Expected reply: `Please send one clear photo that shows the issue.`

Then start the normal gateway and manually run the fixed demo prompts through Telegram and WhatsApp. Complete photo, pin, confirmation, claim, and resulting-case checks from the spec. These two rehearsals need real messages from the developer's channel accounts and cannot be replaced by the local invoke smoke.

## Serving shutdown

After the manual rehearsal:

1. Stop the local gateway.
2. Stop the temporary tunnel.
3. Recover the latest serving evidence and logs.
4. Stop the named Colab runtime.
5. Rotate the temporary Hugging Face and inference API tokens.
