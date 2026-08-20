---
name: to-tickets
description: Break a hackathon feature spec into small capability-based tickets that each produce a concrete, human-verifiable result.
disable-model-invocation: true
---

# To Tickets

Break a feature spec, plan, or confirmed conversation into a sequence of **small capability tickets**.

Tickets exist to keep the coding agent's feedback loop short.

The goal is:

**build something small → verify it works → continue**

Do not split work by architecture layer.

## Process

### 1. Gather context

Read the supplied spec and relevant project docs.

Inspect the codebase before creating tickets so you understand:

- existing project structure;
- relevant modules and routes;
- database/schema locations;
- existing integrations;
- files likely to be created or modified.

Do not re-open product decisions already settled in the spec.

### 2. Split by capability

Break the feature into the smallest meaningful capabilities that can be implemented and verified independently.

A ticket may cross frontend, backend, database, API, or integration layers when those pieces are all required to make one capability work.

Prefer:

```text
Upload a document and verify it is stored.
```

over:

```text
Create upload UI.
Create upload API.
Create documents table.
```

Do not create horizontal tickets merely because different architectural layers are involved.

### 3. Keep tickets small

Target work that an agent can reasonably finish in one focused burst, usually around **15–30 minutes**.

If a ticket contains multiple independently verifiable outcomes, split it further.

Do not split it so far that the resulting ticket produces no meaningful capability on its own.

Every ticket must answer:

> What new thing can be verified after this ticket that could not be verified before?

The verification may happen through:

- the UI;
- an API response;
- the database;
- logs;
- an external integration;
- another directly observable system result.

User-facing output is not required.

### 4. Preserve dependencies

Order tickets according to real implementation dependencies.

Each ticket should declare which earlier tickets block it.

Prefer simple dependency chains when that reflects the actual feature.

Do not invent parallelism or complex dependency graphs for their own sake.

Avoid broad setup, foundation, refactor, testing, or polish phases.

Create a dedicated enabling/refactor ticket only when the next capability genuinely cannot be implemented cleanly without it. Otherwise keep small supporting changes inside the capability ticket they enable.

### 5. Include the change surface

Each ticket should identify the files expected to be created or modified.

Use exact paths after inspecting the repository.

When an exact path cannot reasonably be known yet, mark it as a likely file rather than inventing certainty.

The listed files guide the implementation agent; they do not forbid touching another file when implementation requires it.

### 6. Write each ticket

Use this format:

```md
# <NN> — <Ticket title>

## Goal

Describe the single capability this ticket makes work.

Keep this focused on behaviour, not architecture layers.

## Files

Create:

- `<path>`

Modify:

- `<path>`

## Implementation notes

- Only include decisions the implementation agent must preserve.
- Keep this section short.
- Omit it when no additional guidance is needed.

## Blocked by

- `<NN> — <ticket title>`

Or:

None.

## Done when

- A concrete observable result works.
- The result can be manually verified.
```

`Done when` must describe outcomes, not implementation steps.

Prefer:

```text
A natural-language query returns the expected related records.
```

over:

```text
Retrieval function has been implemented.
```

### 7. Save the tickets

Use the project's existing ticket location when one exists.

Otherwise create:

```text
docs/tickets/<feature-slug>/
```

and save one file per ticket:

```text
01-<slug>.md
02-<slug>.md
03-<slug>.md
```

Number them in dependency order.

Do not generate a separate testing plan.

Do not add automated test work unless the spec explicitly requires it or the capability contains logic where automated verification clearly provides high leverage.

Do not start implementation yet.

Completion criterion: every ticket is small, dependency-aware, names its expected change surface, and produces a concrete result the user can verify before moving to the next ticket.
