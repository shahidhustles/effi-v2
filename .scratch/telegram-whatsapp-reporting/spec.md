# Complete Telegram and WhatsApp Reporting

Status: ready-for-agent

## Problem Statement

Citizens need a low-friction way to register civic complaints through messaging channels they already use. The reporting experience must accept Indian-language text and voice, understand a supporting photo, capture exact coordinates, ask only for missing information, and create one authenticated report without requiring a separate citizen app.

Telegram and WhatsApp must provide the same reporting journey through one Effi backend. Channel differences, repeated webhook events, interrupted conversations, language changes, provider failures, and rapid message bursts must not lose evidence or create duplicate reports.

## Solution

Effi will provide one shared report-registration journey through Telegram and WhatsApp. A standalone, always-on Eve service will run the same agent, instructions, persistence flow, and submission tool for both channels. Telegram will use Eve's native Telegram channel. WhatsApp will use the community Baileys adapter through Eve's Chat SDK channel and will be treated as a hackathon transport that can be replaced without changing the reporting domain.

Citizens can describe an issue using text or a voice note, provide a mandatory photo, and share either their current GPS coordinates or a manually selected location pin. Effi mirrors the modality and language of the citizen's latest input, supports mid-conversation switches, and asks one focused clarification at a time. Direct-message drafts are anonymous, resume only for the same channel, sender, and chat, and expire after seven days of inactivity. Once the citizen approves the final interpretation, the model prepares an immutable pending submission and returns an opaque, 24-hour authentication link. Successful authentication creates exactly one report and returns its report ID.

The hackathon deployment will use staged, non-sensitive data. It will not provide case-status tracking through messaging channels.

## User Stories

1. As a citizen, I want to begin a civic complaint in Telegram, so that I can report an issue without installing another application.
2. As a citizen, I want to begin the same civic complaint journey in WhatsApp, so that I can use the messaging channel familiar to me.
3. As a citizen, I want both bots to behave consistently, so that my channel choice does not change what evidence I must provide.
4. As a citizen, I want to describe an issue in a supported Indian language, so that I do not have to report in English.
5. As a citizen, I want Effi to answer text input with text in the language I just used, so that the conversation remains natural.
6. As a citizen, I want to report through voice notes, so that literacy or typing constraints do not prevent me from registering a complaint.
7. As a citizen, I want Effi to answer a voice note with a voice note in the detected spoken language, so that I can continue without reading or typing.
8. As a citizen, I want Effi to follow a language change during the conversation, so that I can speak naturally or code-switch.
9. As a citizen, I want Effi to follow a switch between voice and text, so that its next response matches the way I most recently replied.
10. As a citizen whose speech cannot be understood, I want Effi to ask me in Hindi to try again, so that a failed transcription does not silently corrupt my report.
11. As a citizen, I want to attach a photo of the civic issue, so that the report contains visual evidence.
12. As a citizen, I want Effi to explain why a photo is insufficient and request a better one, so that I know how to complete the report.
13. As a citizen, I want unlimited reasonable opportunities to replace an insufficient photo, so that one poor upload does not permanently block me.
14. As a citizen, I want to cancel or ask for help during the photo retry loop, so that I am not trapped in the conversation.
15. As a citizen, I want to share my current GPS location, so that Effi can pinpoint the issue without relying on a typed description.
16. As a citizen reporting an issue elsewhere, I want to share a manually selected map pin, so that the stored coordinates identify the actual issue location.
17. As a citizen, I want Effi to confirm the received location, so that I can catch an incorrect pin before submission.
18. As a citizen, I want Effi to ask only one focused clarification at a time, so that completing the report does not feel like filling a complex form.
19. As a citizen, I want Effi to remember an incomplete complaint for seven days when I return to the same direct-message chat, so that I do not have to repeat earlier information.
20. As a citizen, I want rapid text, photo, and location messages to be considered together, so that Effi does not answer each partial message independently.
21. As a citizen, I want to review Effi's complete interpretation before submission, so that I remain in control of what becomes an official report.
22. As a citizen, I want to correct the interpretation using a channel action or natural text or voice, so that I can fix individual details conversationally.
23. As a citizen, I want to receive the complete updated interpretation after a correction, so that I know exactly what I am confirming.
24. As a voice-note user, I want the final interpretation in both text and voice, so that I can listen to it while still inspecting exact details.
25. As a citizen, I want Effi to require explicit confirmation, so that silence or an unrelated reply never submits a report.
26. As a citizen, I want to authenticate only after confirming the final interpretation, so that sign-in does not interrupt complaint gathering.
27. As a citizen, I want an abandoned authentication attempt to preserve the pending submission and let me request a replacement link, so that I can return and complete sign-in before it expires.
28. As a citizen, I want a clear report ID after successful authentication, so that I have an acknowledgement that the complaint was registered.
29. As a citizen, I want to cancel an unfinished complaint or start a new one with isolated memory, so that details from an older complaint do not leak into it.
30. As a citizen, I want my received messages and evidence preserved during a provider failure, so that I only resend content that Effi genuinely failed to receive.
31. As an officer, I want reports from both bots to use the same case pipeline, so that channel choice does not create separate operational systems.
32. As an officer, I want the original conversation and every attachment reference preserved, so that I can inspect how the report was assembled.
33. As an officer, I want insufficient photos excluded from primary case evidence but retained in the original conversation, so that the brief stays useful without erasing history.
34. As an operator, I want repeated platform events and authentication callbacks to be idempotent, so that retries cannot create duplicate messages or reports.
35. As an operator, I want provider and model choices to remain configurable, so that a hackathon-specific dependency can be replaced before launch.
36. As an operator, I want model, speech, and delivery failures recorded internally without exposing technical details to citizens, so that failures can be diagnosed safely.
37. As an operator, I want the hackathon model restricted to staged, non-sensitive inputs, so that contributor-tier data reuse does not expose real citizen information.

## Implementation Decisions

- Run Eve as a standalone, always-on Node service. Next.js is not required for the bot backend. The always-on runtime is necessary for Baileys' persistent WhatsApp WebSocket and authentication state.
- Use one Effi Eve agent and one shared reporting backend for both channels. Channel integrations normalize transport concerns; they do not implement separate reporting agents.
- Use Eve's native Telegram channel for Telegram.
- Use `chat-adapter-baileys` through Eve's Chat SDK channel for WhatsApp. Baileys is an unofficial, replaceable hackathon transport and is not presented as the production WhatsApp integration.
- Keep the existing channel-adapter seam for platform verification, inbound normalization, media acquisition, and outbound delivery.
- Normalize every inbound event into a shared citizen-message contract containing channel, external message ID, conversation identity, sender identity, text when present, stored attachments, coordinates when present, and receipt time.
- Persist every inbound message and attachment reference before invoking speech or model providers. Copy platform media into Effi-controlled storage rather than relying on temporary platform URLs.
- Eve owns durable agent-session execution. Convex owns application records, normalized messages and attachments, pending submissions, authenticated reports, cases, and audit history. Baileys authentication keys live on an encrypted persistent volume for P0.
- Support reporting only in direct messages. Allow one active anonymous report draft per channel, sender, and direct-message conversation. Use an opaque deterministic scope key for lookup; keep the raw provider identity only where it is needed to deliver the bot response. One report maps to one Eve session. After cancellation, expiry, or successful registration, a later complaint begins a fresh, memory-isolated session.
- Persist every anonymous draft in Convex for seven days after its last activity. Resume an agent turn from durable report state and a bounded recent-message context rather than blindly replaying the full transcript. On draft cancellation or expiry, remove its messages, transcripts, attachment references, and controlled media together. A successfully claimed report retains its original conversation and evidence as report records.
- Use Eve steering while gathering a report. Persist a new message first, cancel the active model turn, and start the replacement turn with the updated history. Disable streaming delivery so citizens never receive partial output from cancelled turns.
- Lock the report conversation after explicit confirmation. Messages received while authentication is pending receive a deterministic prompt to complete authentication and cannot steer or mutate the frozen submission; an explicit confirmation after a link expires may issue a replacement link for that same pending submission.
- Deduplicate inbound events by provider message ID. Process each active report through Eve's steering rules while allowing unrelated citizens and conversations to proceed concurrently.
- Mirror the citizen's latest modality on ordinary turns: text receives text; voice receives voice only. Re-detect language on every input so citizens can switch languages and modality mid-conversation.
- Use Hindi voice as the default recovery response when voice language detection fails or the speech is unintelligible. If voice synthesis cannot ultimately produce that response, send text.
- Make final confirmation the only normal modality exception. Always provide the complete structured interpretation as text; also provide it as a voice note when the latest citizen input was voice.
- Support Confirm and Edit channel actions where available while also accepting natural-language text or voice corrections. Edit asks which detail is wrong, updates that detail conversationally, and presents the full interpretation again.
- Require an understandable issue, at least one model-accepted photo, and exact coordinates before confirmation. Text or voice alone never satisfies the photo requirement.
- Have the same vision-capable conversational model inspect every decoded image. A clearly unrelated or unusable image does not satisfy completeness. An uncertain image triggers a focused request for a clearer or more relevant image. There is no fixed retry limit.
- Retain every received image in the original conversation. Only model-accepted images become primary submitted evidence.
- Support two P0 location inputs: current GPS location and a manually selected map pin. Both must yield latitude and longitude. Typed addresses and landmarks do not satisfy P0 completeness, and the model must not infer location from a photo.
- Present the final interpretation and accept corrections before authentication. Once the citizen explicitly confirms it, freeze the interpretation and call a single submission-preparation tool.
- The submission-preparation tool validates required fields, persists or returns one immutable pending submission, and returns an opaque, single-use 24-hour authentication link bound to the pending submission and original channel conversation. The URL contains no report text, coordinates, media references, Convex identifiers, or authentication data; only a securely stored claim-secret hash is retained server-side.
- Successful Clerk authentication atomically creates or returns the authenticated citizen, report, initial case, and submission audit event from the immutable pending submission, then sends one report-ID acknowledgement to the original channel. Post-confirmation edits are not supported; changing the report requires cancelling and returning to the confirmation flow.
- Make report creation and authentication callbacks idempotent. Never retry a consequential write without the pending submission's stable idempotency key.
- Use Vercel AI Gateway with `meta/muse-spark-1.2-contributor` as the primary hackathon model and `google/gemini-3.6-flash` as the fallback for provider errors, timeouts, or rate limits. Record the model used for each turn. Do not fall back merely because an answer is unsatisfactory.
- Restrict the contributor model to staged, non-sensitive hackathon data. Before accepting real citizen data, replace it with a non-contributor model and review provider data controls.
- Use Sarvam Saaras v3 for primary speech-to-text. Use Sarvam Bulbul v3 for primary text-to-speech and Cartesia Sonic 3 as the second text-to-speech provider. If both synthesis providers fail, send text.
- Promise voice-note behavior only for languages supported by the necessary provider chain and verified with representative demo samples. The text conversation can support a broader tested set.
- Retry transient media, storage, speech, model, and delivery failures once. Preserve accepted inputs across failures, use configured provider fallbacks, and return a brief citizen-facing recovery instruction only when automatic recovery fails.
- Do not provide report or case status lookup through Telegram or WhatsApp. These channels register complaints and acknowledge successful registration only.

## Testing Decisions

- Prefer one high behavioral seam: inject a platform event through a Telegram or WhatsApp adapter and assert the externally visible reply plus the final authenticated report, original conversation, evidence references, coordinates, and idempotency outcome in persistence.
- Reuse the existing fake channel-adapter pattern and extend it to represent inbound text, voice, image, location, duplicate delivery, and outbound media. Tests should observe normalized behavior rather than Baileys or Telegram SDK internals.
- Use fake speech, model, media-storage, and authentication providers in the primary journey tests. Provider integrations receive narrow contract tests against recorded non-sensitive fixtures so the main tests remain deterministic.
- Run the complete text journey against both channel adapters: supported-language text, accepted photo, GPS or manual pin, clarification, edit, confirmation, authentication, one report, and acknowledgement ID.
- Run the complete voice journey against both channel adapters: voice replies, language switching, modality switching, mandatory photo, location, text-plus-voice final confirmation, authentication, and acknowledgement.
- Run the reliability journey against both channel adapters: burst messages steer into one coherent response; duplicate events are ignored; a direct-message report resumes for the same sender and chat after restart within seven days; cancellation or expiry starts a clean report and erases anonymous draft content; accepted evidence survives provider failure; repeated authentication callbacks create one report.
- Verify photo behavior externally: unreadable media fails at ingress; irrelevant or uncertain photos cause a focused retry; a later accepted photo unlocks confirmation; all attachment references remain in conversation history while only accepted photos become primary evidence.
- Verify location behavior externally: current GPS and manual pins are accepted; typed-address-only messages remain incomplete; the confirmed report stores exact coordinates.
- Verify language and modality behavior externally on every turn, including Hindi recovery for unintelligible speech and text recovery after both text-to-speech providers fail.
- Verify steering safety: no cancelled partial response reaches the citizen, no consequential tool runs before explicit confirmation, and the confirmed submission cannot be steered.
- Verify authentication behavior: the opaque link is single-use, lasts 24 hours, is bound to the correct pending submission and channel conversation, can be reissued for the same frozen submission after expiry, and unsuccessful authentication does not create a report.
- Verify that no Telegram or WhatsApp action or natural-language request exposes case status in P0.
- Treat tests as proof of user-visible behavior and durable outcomes. Do not assert internal method order, private framework state, model prose, or provider implementation details.

## Out of Scope

- Case-status lookup, detailed timelines, or proactive case updates through Telegram or WhatsApp
- Citizen-app reporting or tracking
- Typed address and landmark geocoding
- Cross-channel identity linking, report continuation, or migration between Telegram and WhatsApp
- Video input or analysis
- Deep image manipulation detection, capture-time verification, geolocation inference from images, or advanced media-quality scoring
- A separate image-analysis service
- Embeddings, semantic retrieval, or RAG
- Production use of Baileys or the contributor-tier model with real citizen data
- Advanced retention or archival policies beyond the fixed seven-day anonymous-draft expiry
- Detailed officer workflows, Ask Effi, pattern intelligence, resolution verification, and analytics

## Further Notes

- This spec intentionally overrides earlier P0 wording that allowed typed addresses or landmarks and messaging-channel status lookup.
- Photo evidence is mandatory even when the citizen's text or voice description is otherwise understandable.
- The final confirmation exception is deliberate: exact report details remain inspectable as text while voice users also receive an audio rendering.
- The primary model's advertised speed is not itself acceptance evidence. Validate end-to-end response time with the actual Eve prompt, image inputs, tool schema, AI Gateway route, and both messaging channels.
- Provider language lists are an upper bound, not a product claim. The supported demo-language list must be based on end-to-end speech recognition, model comprehension, response generation, and speech synthesis tests.
