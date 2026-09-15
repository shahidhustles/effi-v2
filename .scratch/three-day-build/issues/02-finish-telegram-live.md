# 02 - Finish the live Telegram journey

Status: completed

## Goal

A real Telegram user can describe a civic issue by Hindi voice, attach a usable photo, share GPS coordinates or a selected pin, confirm Effi's interpretation, complete Clerk sign-in, and receive the real report ID in Telegram.

## Confirmed journey

1. The citizen sends a Hindi voice note describing one civic issue.
2. Effi replies in Hindi voice during the conversation. The final interpretation appears as readable text and voice.
3. The citizen sends at least one usable photo. Effi rejects an unusable photo and does not attach it to the report.
4. The citizen shares a current GPS location or selected pin. A typed address does not count.
5. Effi shows the issue, category, coordinates, and accepted photo IDs.
6. The citizen confirms once with a Telegram button or a typed reply. That confirmation authorizes preparation of the claim link. Do not ask for a second approval.
7. The citizen opens the opaque claim link in Telegram Desktop and signs in through Clerk on the local dashboard.
8. Convex creates exactly one report and one case after authentication. The claim page and Telegram show the same `RPT-...` report ID.

If the citizen edits the issue, photo, or location, Effi collects the replacement and shows the complete interpretation again before accepting confirmation.

## Files

Modify as required by observed failures:
- `apps/bot-gateway/package.json`
- `pnpm-lock.yaml`
- `apps/bot-gateway/agent/agent.ts`
- `apps/bot-gateway/agent/channels/telegram.ts`
- `apps/bot-gateway/agent/instructions.md`
- `apps/bot-gateway/agent/lib/telegram-reporting.ts`
- `apps/bot-gateway/agent/tools/ask_question.ts`
- `apps/bot-gateway/agent/tools/assess_staged_image.ts`
- `apps/bot-gateway/agent/tools/prepare_submission.ts`
- `apps/bot-gateway/src/deepgram-voice-provider.ts`
- `apps/bot-gateway/src/cartesia-voice-provider.ts`
- `apps/bot-gateway/src/reliable-voice-provider.ts`
- `apps/bot-gateway/src/voice.ts`
- `apps/bot-gateway/tests/voice.test.ts`
- `apps/bot-gateway/.env.example`
- `apps/bot-gateway/src/channel-auth-callback.ts`
- `apps/officer-dashboard/app/effi/auth/[claimToken]/[[...rest]]/claim-completion.tsx`
- `scripts/effi-bot.sh`

## Implementation notes

Start from the current code. Register the real webhook and fix only failures seen in the live path. Do not rebuild the Telegram adapter or add a new simulated reporting layer.

- Upgrade Effi from Eve `0.39.0` to the current stable npm release and use that release's bundled documentation as the API source.
- Use local Eve, local dashboard, development Convex, and ngrok for the Telegram webhook. The claim URL remains `http://localhost:3000`, so run the human journey from Telegram Desktop on this Mac.
- Use Deepgram Nova-3 for voice-note transcription with language detection and Cartesia Sonic 3.5 for voice replies, matching the proven `eve-wa-adapter` integration. Required local values are `DEEPGRAM_API_KEY`, `CARTESIA_API_KEY`, and `CARTESIA_VOICE_ID`.
- One explicit citizen confirmation is the only submission confirmation. Remove the extra tool approval from `prepare_submission`.
- Require one accepted photo. Allow additional accepted photos without adding album-specific work.
- Keep report creation behind Clerk authentication. A pending draft is not a submitted report.
- An expired, invalid, or reused claim must show an honest failure and must not create another report.
- Keep provider deduplication so Telegram retries cannot create duplicate reports or acknowledgements.
- Disable Eve's default shell, file, web, todo, and subagent tools. The public reporting bot exposes only `ask_question`, `assess_staged_image`, and `prepare_submission`.

## Scope limits

- Prove one valid photo in the recorded journey. Check bad-photo rejection separately.
- Do not deploy the dashboard or add a second public tunnel in this ticket.
- Do not add citizen-app voice, video, case-status chat, analytics, or new provider abstractions.
- Do not rewrite working report, evidence, claim, or acknowledgement code unless the live journey exposes a failure.

## Blocked by

- 01 - Fix the gateway feedback loop

## Done when

- One recorded Telegram Desktop run completes Hindi voice, a usable photo, an exact location, interpretation, one confirmation, Clerk sign-in, and acknowledgement.
- Convex contains exactly one report and one case for the run.
- The claim page and Telegram show the same real `RPT-...` report ID.
- Replaying a Telegram message or reusing the claim link does not create a second report or acknowledgement.
- A bad photo is rejected without becoming accepted evidence.
- Gateway tests, typecheck, lint, and build pass against the upgraded Eve version.

## Human test

1. Start the dashboard on port 3000, then start Eve and ngrok with `scripts/effi-bot.sh start`.
2. Register the current Telegram webhook with `scripts/effi-bot.sh webhook`.
3. In Telegram Desktop, send a short Hindi voice report, one clear photo, and a location pin.
4. Confirm that ordinary replies use Hindi voice and the final interpretation arrives as both text and voice.
5. Choose Confirm once. Open the claim link, sign in through Clerk, and record the report ID shown on the page.
6. Confirm Telegram receives the same report ID.
7. Inspect Convex and confirm the run created one report and one case.
8. Reopen the claim URL and confirm it does not create another report.
9. In a fresh report, send an unrelated or unreadable photo and confirm Effi requests a replacement.
