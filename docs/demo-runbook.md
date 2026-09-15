# Effi demo runbook

One demo path: a citizen report enters through Telegram, WhatsApp, or the Expo app, becomes a Convex case, and an officer acts on it in the dashboard.

Rehearse this once on the demo machine before the live run.

## What you need

- Node.js 22 or later, Corepack enabled, `pnpm install` run once
- `ngrok` on `PATH` for the Telegram webhook
- An Android device or emulator with Expo Go
- A fine-tuned model endpoint (`.scratch/effi-model-finetuning/RUNBOOK.md` shows how to serve it on Colab and expose it with cloudflared)
- Clerk instance with a JWT template named `convex` that includes `name` as `{{user.first_name}} {{user.last_name}}`
- At least one officer account and one password-only citizen account in that Clerk instance
- A Telegram bot token and the test phone's WhatsApp account

## Environment

Values live in `.env.local` files, never in Git. Start from each `.env.example`.

| File | What goes in |
| --- | --- |
| `packages/backend/.env.local` | `CONVEX_DEPLOYMENT` from the Convex CLI |
| Convex deployment env | `CLERK_JWT_ISSUER_DOMAIN`, `EFFI_GATEWAY_CONVEX_SECRET`, `EFFI_GATEWAY_MEDIA_ERASURE_URL` |
| `apps/officer-dashboard/.env.local` | Clerk keys, `NEXT_PUBLIC_CONVEX_URL`, `EFFI_BOT_GATEWAY_URL`, `EFFI_AUTHENTICATION_BASE_URL`, `EFFI_AUTH_CALLBACK_SECRET` |
| `apps/citizen-app/.env.local` | `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_CONVEX_URL` |
| `apps/bot-gateway/.env.local` | Telegram bot token and webhook secret, `CONVEX_URL`, `EFFI_DRAFT_SCOPE_SECRET`, `EFFI_GATEWAY_CONVEX_SECRET`, `EFFI_AUTH_CALLBACK_SECRET`, `EFFI_AUTHENTICATION_BASE_URL`, `OPENCODE_API_KEY` (optional; the start script otherwise reads `~/.local/share/opencode/auth.json`), `WHATSAPP_CONNECT`, `WHATSAPP_ALLOWED_NUMBERS`, and Deepgram/Cartesia keys when voice is in the run |

Set the Convex deployment values from `packages/backend`:

```sh
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-instance.clerk.accounts.dev
npx convex env set EFFI_GATEWAY_CONVEX_SECRET "$(openssl rand -hex 32)"
npx convex env set EFFI_GATEWAY_MEDIA_ERASURE_URL https://your-tunnel.ngrok.app/effi/v1/internal/erase-anonymous-draft-media
```

The erasure URL and the dashboard's `EFFI_BOT_GATEWAY_URL` point at the same ngrok tunnel as the Telegram webhook.

`EFFI_AUTHENTICATION_BASE_URL` is the dashboard claim route: `http://localhost:3000/effi/auth`. `EFFI_AUTH_CALLBACK_SECRET` is the same random value in the dashboard and the gateway.

`WHATSAPP_ALLOWED_NUMBERS` is a comma-separated E.164 list without `+`. The channel ignores every other number, groups, status broadcasts, and Message Yourself.

### Provision the demo officer

The dashboard rejects any Clerk account that has no `identities` row with role `officer` or `admin`. Provision once, from `packages/backend`:

```sh
npx convex run cases:provisionOfficer '{"externalId":"https://your-instance.clerk.accounts.dev|user_xxx","role":"officer"}'
```

The `externalId` is the Clerk token identifier: issuer, a `|`, then the user ID from the Clerk dashboard.

## Start the services

Four terminals, in this order.

1. Convex dev server:

   ```sh
   corepack pnpm --filter @effi/backend convex:dev
   ```

2. Officer dashboard on port 3000:

   ```sh
   corepack pnpm --filter @effi/officer-dashboard dev
   ```

3. Citizen app on the Android device or emulator:

   ```sh
   corepack pnpm --filter @effi/citizen-app android
   ```

   The password sign-in flow runs in Expo Go. Only Clerk's native components need a development build, and the app does not use them.

4. Bot gateway and tunnel:

   ```sh
   ./scripts/effi-bot.sh start
   ./scripts/effi-bot.sh webhook
   ./scripts/effi-bot.sh logs
   ```

   The gateway serves Eve on port 2000 and starts the model endpoint it is configured with. Watch the log for the WhatsApp QR on first start: WhatsApp, Linked Devices, Link a device. The QR does not appear again until the saved credentials are removed from `.data/whatsapp-auth`.

   If ngrok restarts, run `./scripts/effi-bot.sh webhook` again, then update `EFFI_GATEWAY_MEDIA_ERASURE_URL` and the dashboard's `EFFI_BOT_GATEWAY_URL`.

Useful checks:

```sh
./scripts/effi-bot.sh status
./scripts/effi-bot.sh restart --fresh   # wipe durable gateway sessions before a clean run
```

## Demo order

1. Telegram. Message the bot, send a photo, then a GPS pin. Effi asks for anything missing, shows its interpretation, and waits for confirmation. Confirm, open the claim link, sign in as the citizen, and return to Telegram for the report ID. The same conversation receives the acknowledgement.
2. WhatsApp. Repeat from the allowed phone: text, photo, GPS or pin, confirm, claim, report ID. Send one voice note and let Effi answer with voice; if synthesis fails it answers with text, which is an accepted fallback.
3. Officer dashboard. Sign in as the provisioned officer. Both cases appear in the inbox with real evidence. Open one, assign it, change its priority, advance its status, and resolve it with a note. The audit history lists every change.
4. Citizen app. Sign in as the citizen, submit a report with text, category, one photo, and current location. Review and submit. The report number appears, the case shows up under My cases, and when the officer advances its status the app updates without a refresh.

## Constraints and fallbacks

- Telegram only receives messages after the webhook is registered. If the bot is silent, check `./scripts/effi-bot.sh status` and re-run `webhook`.
- The WhatsApp channel is an unofficial Baileys socket for the demo. Keep the demo number in the allowlist, use non-sensitive data, and re-link by QR if it logs out.
- The model endpoint has no fallback. If a turn fails, the draft is still stored and the citizen can send the message again. Retry before switching channels.
- Voice needs Deepgram and Cartesia keys. Without them, demo text everywhere and skip the voice turn.
- The claim link is valid for 24 hours. `/clear` and `/reset` cancel the active draft immediately.
- A citizen sign-in that asks for a second factor will not complete in the app. Use a password-only citizen account.
- If the officer has no cases after signing in, the identity is not provisioned. Run the `provisionOfficer` command above.
- If the dashboard returns `acknowledgement unavailable`, one of `EFFI_BOT_GATEWAY_URL`, `EFFI_AUTH_CALLBACK_SECRET`, or `EFFI_AUTHENTICATION_BASE_URL` is missing or the tunnel URL changed.
- If the app shows the configuration screen, `.env.local` is missing `EXPO_PUBLIC_CONVEX_URL` or `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
