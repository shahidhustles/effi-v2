---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

For UI tickets: read `PRODUCT.md`, `DESIGN.md`, and the ticket's approved shape brief before editing.
Run `node .agents/skills/impeccable/scripts/context.mjs --target <route-or-component>` once.
Use established tokens and shared components; do not introduce one-off visual values without ticket approval.
Before completion, run the relevant `$impeccable audit <target>`; use critique/polish for substantial UI changes.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Commit your work to the current branch.
