---
name: to-spec
description: Turn confirmed hackathon decisions into a concise implementation-ready feature spec without restarting discovery.
disable-model-invocation: true
---

# To Spec

Turn the current conversation, confirmed decisions, and relevant codebase context into a concise feature spec.

The spec exists to keep the coding agent aligned while moving quickly. It is **not documentation for its own sake**.

Do not interview the user. If important product decisions are still unresolved, recommend `/grill-fast` instead.

## Process

### 1. Gather context

Use everything already established from:

- the current conversation;
- `/grill-fast` decisions;
- existing project docs;
- relevant research or prototypes;
- the existing codebase.

Do not re-ask resolved questions.

Do not expand the feature beyond the user's intended scope.

If a small detail is missing and cheap to change later, make a reasonable assumption and record it.

### 2. Understand the implementation shape

Explore the relevant codebase before writing implementation decisions.

Understand:

- existing modules and patterns that can be reused;
- important data and state;
- external integrations;
- where the feature connects to existing code;
- any architectural constraint that materially affects implementation.

Prefer existing project patterns unless changing them clearly simplifies the feature.

Do not design every internal function, file, or abstraction in advance.

### 3. Write the spec

Use this structure:

# <Feature Name>

## Goal

Describe what the user should be able to accomplish and the value the feature provides.

Keep this short.

## User Flow

Describe the important end-to-end behaviour in the order the user experiences it.

Focus on observable behaviour rather than screens, endpoints, or implementation layers.

## Requirements

List only requirements necessary to make the intended feature work.

Include:

- required behaviour;
- important states;
- meaningful edge cases;
- constraints already decided by the user.

Avoid exhaustive user stories and speculative requirements.

## Implementation Decisions

Record only decisions that meaningfully constrain how the feature should be built.

This may include:

- modules or interfaces that need to exist or change;
- important architecture choices;
- data or state changes;
- external integrations;
- important contracts between parts of the system;
- technical decisions already confirmed during planning.

Do not include specific file paths unless the existing codebase makes the location itself important.

Do not over-design internals that the implementation agent can safely decide while coding.

## Demo / Acceptance

List the smallest set of observable behaviours that prove the feature works.

Prefer human-verifiable outcomes.

Example:

- [ ] User can submit a report with an image.
- [ ] The report appears in the officer dashboard.
- [ ] The officer can change its status.
- [ ] The user sees the updated status.

These are acceptance behaviours, not mandatory automated tests.

## Out of Scope

Explicitly list nearby features or complexity that should not be built as part of this work.

Use this section to protect the hackathon scope from expanding during implementation.

### 4. Keep verification lightweight

Automated testing is optional.

For normal hackathon features, prefer:

- typechecking;
- build validation;
- obvious runtime errors and lint failures;
- human testing of the completed flow.

Do not add testing work merely to satisfy a process.

### 5. Keep the document small

The spec should contain enough information for a fresh coding-agent session to build the feature correctly without carrying the entire planning conversation.

Remove:

- repeated discussion;
- rejected ideas unless they define scope;
- exhaustive edge cases;
- enterprise-scale concerns irrelevant to the hackathon;
- implementation details the coding agent can decide locally.

If the document starts becoming a design document for the entire application, narrow it back to the feature being specified.

### 6. Save the spec

Use the project's existing spec location when one exists.

Otherwise save it as:

`docs/specs/<feature-slug>.md`

Do not break the work into tickets yet.

`/to-tickets` owns implementation slicing and dependency ordering.

Completion criterion: a fresh coding-agent session can read the spec and clearly understand what to build, the important constraints, and what visible behaviour proves the feature is complete.