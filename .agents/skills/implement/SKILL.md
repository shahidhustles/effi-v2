---
name: implement
description: Implement one hackathon ticket cleanly using current documentation, simple readable code, human-verifiable outcomes, and one focused commit.
disable-model-invocation: true
---

# Implement

Implement the requested ticket as one focused unit of work.

Optimize for a short feedback loop:

**understand → build → verify → review architecture → human test → commit**

The goal is working, understandable code — not maximum abstraction, maximum tests, or process for its own sake.

## 1. Read the context

Before editing code, read:

- the complete ticket;
- the parent feature spec;
- every existing file named by the ticket;
- directly related code needed to understand the current flow;
- relevant project documentation and decisions.

Understand the ticket's:

- goal;
- expected change surface;
- dependencies;
- implementation constraints;
- `Done when` conditions.

Do not redesign product decisions already settled in the spec or ticket.

Stay within the ticket's capability unless a small supporting change is genuinely required to make it work.

## 2. Get current documentation

Never rely on model memory for external library or framework APIs when current documentation can be retrieved.

If an installed skill provides guidance for the relevant technology, use it.

Otherwise use the **Context7 MCP server** to retrieve current documentation for every external library or framework whose API or recommended usage matters to the implementation.

Query only for the parts needed for the ticket.

For example, if implementing a React Flow feature, retrieve current React Flow documentation for the components, hooks, events, or patterns being used before writing that integration.

Do not assume:

- API signatures;
- component props;
- hooks;
- configuration options;
- package structure;
- recommended patterns;
- deprecated behaviour

from model knowledge.

If Context7 does not contain sufficient information, use the library's official documentation as the fallback.

## 3. Implement simply

Write the simplest code that makes the ticket work and remains easy to understand.

Prefer:

- descriptive names;
- straightforward control flow;
- existing project patterns;
- feature logic kept close to where it belongs;
- a small number of concepts;
- small useful interfaces around genuinely complex behaviour.

Avoid:

- premature abstractions;
- generic wrappers with one caller;
- unnecessary factories, managers, providers, repositories, or helpers;
- splitting logic across many shallow modules;
- clever code when boring code is clearer;
- unrelated refactors;
- comments that merely repeat the code.

When several pieces of complexity naturally belong together, hide them behind a small useful interface rather than leaking that knowledge across callers.

Do not create abstractions merely because they might be useful later.

Keep implementation local until there is a real reason for something to become shared.

## 4. Use the ticket as the boundary

Implement the complete capability described by the ticket.

A ticket may require changes across:

- frontend;
- server actions;
- APIs;
- database;
- storage;
- external integrations;
- shared logic.

Do not artificially stop at an architectural layer.

At the same time, do not implement future tickets early unless doing so is unavoidable.

If the ticket's expected file list differs from what the codebase actually requires, adjust intelligently and mention the difference later.

## 5. Verify while building

Use lightweight mechanical verification appropriate to the project.

Run relevant checks such as:

- typechecking;
- build validation;
- linting when useful;
- existing tests covering changed behaviour;
- targeted runtime checks.

Fix errors introduced by the implementation.

Automated tests are optional.

Write new tests only when they provide clear leverage, such as for:

- complex business logic;
- important state transitions;
- parsing or transformations;
- regression-prone behaviour;
- an existing test seam that is cheap and useful.

Do not create tests merely to satisfy a development process.

## 6. Verify the ticket outcome

After implementation, read the ticket's `Done when` section again.

Verify the actual capability, not merely that the code compiles.

Where possible, exercise the result directly through:

- the application;
- an API;
- the database;
- logs;
- an external integration;
- another observable system output.

Do not mark the ticket complete if its observable result does not work.

## 7. Review the resulting architecture

Once the implementation works, inspect the actual diff.

Only now consider architecture questions created by the implementation.

Look specifically for decisions involving:

- which module should own behaviour;
- where an interface or seam should live;
- complexity leaking into several callers;
- duplicated knowledge;
- state or data ownership;
- feature-local code that may genuinely need to become shared;
- dependencies that should remain hidden inside a module;
- shortcuts that could materially affect upcoming tickets.

Do not perform a generic code review or ask about naming/style details.

If meaningful architectural decisions exist, ask the user **1–4 questions in one batch**.

For each question:

- explain the architectural choice briefly;
- explain why it matters;
- provide a **Recommended** answer.

Do not invent questions when the architecture is already straightforward.

Wait for the user's answers before making architecture-driven changes.

Apply only the agreed changes, then re-run the relevant verification.

## 8. Give the human testing steps

Before committing, provide a short manual testing procedure for the user.

The steps must describe exactly how a human can verify this ticket works.

Use the real project and capability rather than generic advice.

Include when relevant:

- where to navigate;
- what data to enter or upload;
- what action to perform;
- what visible result to expect;
- what database/storage/API state to inspect;
- one important failure or edge case worth checking.

Keep the procedure focused on this ticket.

Example structure:

```md
## Human test

1. Start the app with `<command>`.
2. Open `<route/screen>`.
3. Perform `<action>`.
4. Confirm `<expected visible result>`.
5. Check `<database/storage/API>` and confirm `<expected state>`.
6. Try `<important failure case>` and confirm `<expected behaviour>`.
```

Do not require the user to understand implementation details to test the capability.

## 9. Commit the work

After implementation, architecture decisions, and verification are complete:

1. Run `git status`.
2. Review the complete relevant `git diff`.
3. Remove debugging code, temporary files, accidental generated files, and dead experiments.
4. Ensure secrets or credentials are not included.
5. Ensure unrelated user changes are not included in the commit.
6. Confirm the ticket's `Done when` conditions are satisfied.
7. Inspect recent commit history with `git log --oneline -10`.
8. Follow the repository's existing commit-message convention.

If no clear convention exists, use a concise conventional-style message such as:

```text
feat: add document retrieval
fix: handle failed uploads
refactor: simplify complaint ingestion
```

One ticket should normally produce **one focused commit**.

Do not squash or modify unrelated existing commits.

## Completion

Report:

- what capability was implemented;
- important files created or changed;
- verification performed;
- the human testing steps;
- any architecture decision made with the user;
- the resulting commit.

Completion criterion: the ticket's observable result works, the code remains simple and understandable, the user knows exactly how to test it manually, and the work is captured in one clean commit.

```

```
