# 12 - Rehearse and ship the connected demo

## Goal

The project starts predictably and one clean demo runs from citizen input to officer action without manual code edits.

## Files

Modify:
- `README.md`
- `apps/bot-gateway/README.md`
- `scripts/effi-bot.sh`
- `.gitignore`

Create:
- `docs/demo-runbook.md`

## Implementation notes

Document environment groups without secrets, Telegram webhook setup, WhatsApp QR setup, Convex and Clerk startup, dashboard and Expo commands, test phone constraints, demo order, and text fallbacks. Keep credentials and Baileys auth out of Git.

## Blocked by

- 04 - Prove both messaging channels
- 08 - Add officer actions and audit history
- 11 - Build citizen case tracking

## Done when

- A fresh terminal session can start the required services from the runbook and complete one bot report, one dashboard action, and one app report without changing source code.

