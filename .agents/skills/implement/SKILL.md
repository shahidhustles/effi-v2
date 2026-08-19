---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

<!-- 
For UI tickets: read `PRODUCT.md`, `DESIGN.md`, and the ticket's approved shape brief before editing.
Run `node .agents/skills/impeccable/scripts/context.mjs --target <route-or-component>` once.
Use established tokens and shared components; do not introduce one-off visual values without ticket approval.
Before completion, run the relevant `$impeccable audit <target>`; use critique/polish for substantial UI changes. -->

Maintain `DECISIONS.md`: record every meaningful implementation decision and its rationale, including important library, pattern, and trade-off choices.

Maintain `FLOW.md`: document how the affected execution path travels between files, functions, and modules, including call order and the parts being changed.

Before stating to work on any major ticket, quiz the User on the working to test if he knows how the architecture of the ticket is, keep it short. Dont do it if user explicitly mention not to. 

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Commit your work to the current branch.
