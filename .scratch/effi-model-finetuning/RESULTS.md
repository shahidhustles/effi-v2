# Effi model fine-tuning result

Status: dataset generation, T4 QLoRA training, private adapter export, fresh-process reload, fixed notebook rehearsals, T4 serving, and the bot-gateway provider change are complete. Live Telegram and WhatsApp rehearsals still require the developer to send the demo messages through those accounts.

## Final model artifact

- Private repository: `shahidhustles/effi-qwen3-vl-4b-adapter`
- Base model: `Qwen/Qwen3-VL-4B-Instruct`
- Pinned base revision: `ebb281ec70b05090aa6165b016eac8ec08e71b17`
- Adapter size: 132,195,448 bytes
- Quantization: 4-bit base with a QLoRA adapter
- Vision encoder: frozen
- Peak reserved T4 memory: 4.22 GiB

The final private snapshot contains the adapter configuration and safetensors, tokenizer files, processor configuration, chat template, generation configuration, dataset manifest, model metadata, and README.

## Dataset

- Generator version: `effi-training-v3`
- Rows: 630
- Languages: 210 English, 210 Hindi, and 210 Hinglish
- Scenario families: 15
- Priority-labelled rows: 162 critical, 288 high, 108 medium, and 54 low
- Loss policy: assistant messages only
- Citizen media: synthetic fixtures only

The v3 generator makes every persisted confirmed interpretation visible in the fixture context before a submission target. Its validator rejects an explicitly confirmed row when the exact issue or category is absent from that context.

## Training runs

The first full epoch resumed from private checkpoint 25 after a Colab runtime loss and completed 79 updates. It ended at epoch 1.0 with training loss 0.07771282445026349 and exported a 132,195,448-byte adapter.

The first fresh-process rehearsal found a dataset-contract defect: direct submission rows supplied only a generic confirmation prompt while their issue facts existed only in the hidden target. The model produced valid submission calls and sensible low-priority reasoning for low-severity text, but the evaluator expected high priority. The dataset and evaluator were corrected instead of weakening the acceptance check.

The spec-authorized corrective epoch loaded the exported adapter as trainable and ran once over the corrected dataset. It completed 79 updates at epoch 1.0 with training loss 0.010752155095349136, wrote private refinement checkpoints at steps 25, 50, and 75, and replaced the repository-root adapter.

## Final rehearsal

The final inference run started in a fresh process and downloaded the repository-root adapter from the private Hugging Face repository. All ten rehearsals passed:

- satisfactory image assessment, interpretation recording, and confirmation request
- high-priority submission and exact final recipient message
- Hindi drainage image flow
- missing-photo response
- insufficient-photo response
- replacement-photo recovery
- correction before confirmation
- Hindi medium-priority lighting flow
- two materially identical high-priority paraphrases

Every expected tool call used the correct tool name and valid arguments. Both priority paraphrases independently generated `high`, so the consistency result is based on model output rather than fixture labels.

## Durable evidence

The private model repository holds the adapter and exported metadata. This document keeps the verified training and serving figures needed by the project. Generated datasets, executed notebooks, and raw session result files were intentionally removed from the repository after verification because the checked-in generators reproduce them.

## T4 serving result

The adapter served successfully on a Tesla T4 through vLLM 0.26.0 using the pinned base revision, 4-bit bitsandbytes loading, the unmerged LoRA adapter, and the Hermes tool-call parser.

- Cold start on a fresh runtime: 313 seconds, including model download
- Cached restart: about 140 seconds
- Model weights: 3.21 GiB
- Allocated KV cache: 9.49 GiB
- GPU memory during the fixed flow: 13,651 MiB used of 15,360 MiB
- Missing-photo text reply: 11.669 seconds
- High-priority submission tool call: 32.525 seconds
- Final recipient message after the tool result: 4.470 seconds
- Image assessment: 12.614 seconds
- Interpretation recording: 11.087 seconds
- Confirmation question: 21.494 seconds

The fixed serving flow passed. vLLM returned the expected tool names as OpenAI-compatible tool calls rather than raw tagged text. The generated submission used `high` priority with evidence-backed reasons and real fixture citations.

Streaming also passed. The OpenAI client received its first tool delta after 3.178 seconds and completed the tool call after 29.306 seconds with `finish_reason: "tool_calls"`. The repository's AI SDK version then consumed the same endpoint through `createOpenAI(...).chat(...)`, parsed `prepare_submission`, validated its arguments, and finished after 31.194 seconds.

An Eve `invoke` smoke test used the updated gateway provider boundary and returned the expected reply: `Please send one clear photo that shows the issue.` No Telegram or WhatsApp message was sent during this smoke test.

Reproducible serving checks:

- `start-vllm.py`
- `benchmark-vllm.py`
- `benchmark-streaming.py`
- `benchmark-ai-sdk.mjs`

The T4 is adequate for the rehearsed hackathon demo. It is not a production latency result, but it does not justify moving to Modal before the manual channel rehearsal.
