# Effi compact self-hosted model demo

Status: ready to build. This is one implementation spec, not a ticket plan.

## Goal

Fine-tune `Qwen/Qwen3-VL-4B-Instruct` into a compact Effi model that runs on a Google Colab T4, follows the existing Telegram and WhatsApp reporting procedure, assesses complaint photos, produces valid tool calls, and assigns repeatable evidence-backed priorities for the rehearsed hackathon flows.

The result must include the generated dataset, reproducible Colab notebook, private saved adapter, notebook inference, a Colab-hosted inference endpoint if the T4 can sustain it, and the narrow bot-gateway provider change needed to use that endpoint. The citizen app is not part of this work.

## User flow

1. A developer opens the saved notebook and starts a Colab T4 runtime.
2. The notebook installs pinned training dependencies, retrieves the private dataset inputs, and loads Qwen3-VL 4B in 4-bit mode.
3. The notebook generates or loads the sanitized Effi training dataset and rejects malformed examples before training.
4. QLoRA training updates the language, attention, and MLP layers while leaving the vision encoder frozen.
5. The notebook saves checkpoints during training and exports the final adapter, tokenizer, chat template, configuration, and dataset manifest to a private Hugging Face repository.
6. The developer reloads the exported adapter in inference mode and runs the fixed demo conversations inside the notebook.
7. If the T4 has enough memory after training state is released, the notebook starts an authenticated OpenAI-compatible inference endpoint and exposes it through a temporary HTTPS tunnel.
8. The Effi bot gateway uses that endpoint for both Telegram and WhatsApp. It does not silently fall back to Muse.
9. A citizen completes a rehearsed report using text or voice transcript, a photo, a location pin, explicit confirmation, and the existing claim flow.
10. The resulting case keeps the existing Convex transcript, evidence, citation, category, and priority contracts.

## Requirements

### Model and training

- Use `Qwen/Qwen3-VL-4B-Instruct` as the only base model for the first run.
- Pin the exact Hugging Face revision and all Python dependency versions in the notebook once a working combination is found.
- Use Unsloth with TRL `SFTTrainer` and PEFT QLoRA.
- Load the base model in 4-bit mode.
- Freeze vision layers for this run. Fine-tune language, attention, and MLP modules with LoRA.
- Start with per-device batch size `1`, gradient accumulation, FP16, and Unsloth gradient checkpointing. Do not use BF16 on the T4.
- Keep one image at most in each multimodal example and cap image resolution before it enters the dataset.
- Use a vision-aware data collator. Do not truncate or corrupt image placeholder tokens.
- Train for one complete epoch after a short smoke run proves that loading, collation, loss, checkpointing, and export work. Run a second epoch only if the rehearsed prompts clearly fail.
- Save resumable checkpoints outside ephemeral `/content` storage often enough that a Colab runtime loss does not erase the run.
- Stop or pause the Colab session after exporting artifacts.

### Dataset

- Produce roughly 500 to 1,000 clean multi-turn conversations. Quality and coverage matter more than reaching the upper number.
- Seed the dataset only with project-owned demo conversations from the existing WhatsApp and Telegram flows.
- Remove names, phone numbers, sender IDs, provider IDs, claim URLs, authentication secrets, exact coordinates, and any other identifying value before an example becomes training data.
- Do not include genuine citizen data.
- Add synthetic variations for English, Hindi, and Hinglish. Keep other languages out of this run.
- Cover the actual reporting states: issue missing, photo missing, location missing, satisfactory photo, blurred or unrelated photo, correction, explicit confirmation, ambiguous approval, cancellation, submission preparation, and final recipient message.
- Preserve complete tool interactions. Each training row must contain the available tool JSON schemas, assistant tool call, tool result, and citizen-facing continuation where applicable.
- Use the current Effi instructions and schemas as authority. Synthetic data must not invent tools, categories, source IDs, attachment IDs, or workflow states.
- Train on assistant outputs only. Citizen messages, system instructions, and tool results provide context but are not completion targets.
- Store a manifest with the generator version, source category, language, scenario family, model revision, and sanitization status for every row.
- Keep raw transcripts and media out of Git. Commit the generator, schema checks, synthetic fixtures, and notebook generator. Keep generated datasets, manifests, notebooks, and runtime outputs out of the final commit; regenerate them from the checked-in sources when needed.

### Priority policy

- Use only `critical`, `high`, `medium`, and `low`.
- `critical` means the report describes an immediate threat to life or a major active danger.
- `high` means a serious safety hazard, essential-service failure, or substantial impact without an immediate life-threatening condition.
- `medium` means a meaningful civic problem requiring repair without immediate danger.
- `low` means a minor localized inconvenience with little safety impact.
- Every priority example must include one or more reasons grounded in the confirmed report or accepted evidence.
- Near-duplicate examples that preserve the material facts must carry the same priority label.
- Examples with the same category but different severity must teach different priorities when the facts justify it.
- Do not use the fabricated generic `medium` fallback or a category-only priority rule.

### Existing Effi contract

- Reuse `apps/bot-gateway/agent/instructions.md` as the behavioral source, shortened only when building training examples without changing its rules.
- Reuse the existing tools unchanged unless endpoint compatibility forces a narrow adapter change: `assess_staged_image`, `record_report_interpretation`, `ask_question`, and `prepare_submission`.
- Preserve `caseBriefV1Schema` from `packages/ai-contracts/src/index.ts` as the submission argument contract.
- Preserve confirmation, accepted-evidence, real-source citation, category equality, exact-location, and claim-link checks in code. Fine-tuning must not replace these checks.
- The model may recommend a priority, but the existing schema and report store remain responsible for rejecting missing reasons, invalid values, invented citations, and illegal submission attempts.
- Keep current WhatsApp and Telegram channel normalization, persistence, voice transcription, acknowledgement, and Convex behavior.

### Colab artifacts and secrets

- Create one local Colab-ready notebook under `.scratch/effi-model-finetuning/` and save an executed checkpoint copy after a successful run.
- Use the attached Colab MCP for runtime allocation, inspection, file transfer, durable training processes, output polling, and artifact recovery.
- Request a T4 first. Inspect the assigned accelerator and available VRAM before installing or loading the model.
- Store the final adapter in a private Hugging Face repository. Export the tokenizer, processor, chat template, base-model revision, LoRA configuration, generation configuration, and dataset manifest beside it.
- Supply `HF_TOKEN` and any tunnel credential through Colab secrets or process environment only. Never write secrets into the notebook, dataset, logs, repository, or model card.
- Treat Colab RAM and `/content` as disposable. A resumed session must restore dependencies, dataset inputs, and the latest checkpoint from durable storage.

### Inference and gateway integration

- First prove inference inside the notebook after unloading optimizer and training state.
- Attempt T4 inference using the 4-bit base model plus the saved adapter. Merge weights only if the selected server requires it and the merged artifact still fits.
- Prefer an OpenAI-compatible server that preserves Qwen's chat template, multimodal input, and tool-call format.
- Expose the server through an authenticated temporary HTTPS tunnel only for the demo session.
- Add provider-neutral Effi environment variables such as `EFFI_MODEL_BASE_URL`, `EFFI_MODEL_API_KEY`, and `EFFI_MODEL_ID`. Do not overload OpenCode Go names for the self-hosted model.
- Update `apps/bot-gateway/agent/agent.ts` through the existing Eve dynamic model boundary. Do not fork the reporting agent or duplicate tools for each channel.
- Confirm whether the server supports the API shape used by the current AI SDK client. If it only supports Chat Completions, use the compatible AI SDK client at this boundary instead of adding a translation layer across the application.
- Disable automatic Muse fallback. If the endpoint is missing or fails, return a clear bounded provider error and leave the report draft recoverable.
- Keep Modal and Muse as later fallback work. Use Modal only if the Colab T4 cannot host usable inference after the documented memory reductions have been tried.

## Build sequence

1. Record the exact base-model revision, tool schemas, categories, priority values, system instructions, and expected channel behavior.
2. Export project-owned successful demo conversations and sanitize them before any model or notebook receives them.
3. Write the priority-labelled canonical scenarios, including near-duplicate cases whose wording changes but material facts do not.
4. Generate English, Hindi, and Hinglish variations and complete tool-call trajectories from those canonical scenarios.
5. Validate every generated row against the expected conversation shape, known tool names, tool argument schemas, source-ID rules, and allowed state transitions. Remove invalid rows rather than repairing them during training.
6. Create the Colab notebook with separate cells for configuration, dependency installation, durable storage, dataset preparation, model loading, adapter setup, training, export, inference, and endpoint startup.
7. Start a named T4 session through the Colab MCP, inspect the allocation, and transfer only the notebook plus sanitized inputs.
8. Run a short training smoke pass. Fix only environment, memory, data-shape, or checkpoint problems found here.
9. Run one full QLoRA epoch as a durable process and poll it without restarting a silent but active job.
10. Export the adapter and metadata to the private Hugging Face repository before attempting serving.
11. Release training state, reload for 4-bit inference, and run the fixed prompt set inside Colab.
12. Start the inference server and authenticated tunnel on the same T4 if memory and latency are usable.
13. Point the existing Effi provider boundary at the Colab URL and exercise Telegram and WhatsApp without Muse fallback.
14. Save the executed notebook, exact demo commands, endpoint startup command, model revision, and known limitation notes.
15. Pause or stop the Colab session after artifacts have been transferred and the demo run is complete.

## Demo prompts

### Main road complaint

Send:

> There is a deep pothole outside the main entrance of City Hospital. Vehicles are swerving suddenly to avoid it and two bike riders have already fallen.

Then attach a clear pothole photo, share a location pin, explicitly confirm, complete the claim link, and show the resulting officer case. The expected category is `roads`; the facts should support `high` priority.

### Hindi drainage complaint

Send:

> हमारे स्कूल के सामने नाली पूरी तरह बंद है और गंदा पानी सड़क पर भर रहा है। बच्चों को उसी पानी से होकर स्कूल जाना पड़ रहा है।

Then attach a clear photo, share a pin, and confirm. The reply and confirmation must remain in Hindi.

### Missing evidence

Send:

> There is garbage everywhere near our building.

Effi must ask for a photo and then an exact location rather than inventing either one.

### Bad-photo recovery

Send:

> A streetlight has fallen and exposed wires are lying beside the road.

Attach an unrelated or unusably blurred photo. Effi must reject it and request a relevant replacement. Then send the correct photo, location, and confirmation.

### Correction before confirmation

Send:

> A water pipe has burst near the market and water is flooding the road.

After Effi presents its interpretation, send:

> The location is correct, but this is sewage leaking from a broken drain, not a clean water pipe.

Effi must record and display the corrected issue and category before accepting confirmation.

### Hindi voice note

Record:

> हमारे इलाके में तीन दिन से स्ट्रीट लाइट बंद है। रात में पूरा रास्ता अंधेरा रहता है और लोगों को आने जाने में परेशानी हो रही है।

Continue with a photo and location. Voice transcription remains an existing external service; the fine-tuned model consumes its transcript and preserves the response language.

## Demo / acceptance

- [x] A named Colab T4 session can run the saved notebook without manual code edits.
- [x] The notebook produces a non-empty QLoRA adapter and exports it with all required metadata to the private Hugging Face repository.
- [x] The exported adapter reloads in a fresh inference process rather than relying on training-process memory.
- [x] The model completes the main road complaint using the expected tools, valid arguments, explicit confirmation, real evidence references, and a `high` priority recommendation.
- [x] The Hindi drainage and voice-transcript flows keep Hindi citizen-facing replies.
- [x] The missing-evidence flow asks for the next missing item without fabricating a photo or location.
- [x] The bad-photo flow records an insufficient assessment and waits for replacement evidence.
- [x] The correction flow updates the recorded interpretation before submission.
- [x] Two materially identical paraphrases receive the same priority during rehearsal.
- [x] A Colab-hosted endpoint can serve the adapter to the existing gateway with usable demo latency, or the notebook records the concrete T4 blocker before Modal is considered.
- [ ] Telegram and WhatsApp each complete one rehearsed report using the fine-tuned model with automatic Muse fallback disabled.
- [ ] The created report and case retain the current Convex transcript, evidence, citation, category, priority, and claim behavior.
- [x] The final runbook contains the exact Colab restore, inference start, tunnel start, gateway configuration, and shutdown steps.

## Out of scope

- A formal benchmark framework, large held-out evaluation set, or statistical performance claim
- Automated ticket generation or a ticket breakdown for this spec
- Full-model fine-tuning, vision-encoder fine-tuning, DPO, GRPO, or reinforcement learning
- Qwen3-VL 8B or a multi-model comparison before the 4B attempt
- Production hosting, autoscaling, uptime guarantees, or a permanent Colab endpoint
- Automatic Muse fallback or Modal deployment before the Colab result is known
- Citizen-app integration
- Languages other than English, Hindi, and Hinglish
- Genuine citizen conversations or personal media in training
- Replacing the procedural report state machine with learned behavior
- Broad test generation unrelated to the fixed demo flows

## Assumptions and deferred decisions

- The user will provide a Hugging Face account, private repository, and `HF_TOKEN` when implementation reaches export.
- The attached Colab account can allocate a T4, but allocation and session lifetime are not guaranteed.
- The T4 should be attempted for both training and inference. Actual fit is proven only by the completed notebook run.
- Modal serving is deferred until the T4 inference attempt produces a concrete memory, compatibility, or latency blocker.
- Muse fallback design is deferred until the fine-tuned model has been exercised through both channels.
