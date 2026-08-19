# workflow
- When implementing a ticket via the implement skill, do not limit changes to only the explicitly mentioned files/commands — create and modify any other necessary files and follow proper architecture. Confidence: 0.75
- Before starting any major ticket, quiz the User on the architecture to confirm they understand it (keep it short; skip if the user explicitly opts out). Confidence: 0.70
- Use TDD at pre-agreed seams when implementing tickets. Confidence: 0.70
- Run typechecking and single test files regularly during implementation; run the full test suite once at the end. Confidence: 0.70
- Use /code-review to review the work once implementation is complete. Confidence: 0.70
- Maintain DECISIONS.md (meaningful implementation decisions + rationale) and FLOW.md (execution path/call order between files) during implementation. Confidence: 0.70
- When asked to check what's left on a ticket, do NOT run tests — just inspect the code and keep it simple. Confidence: 0.75
