# Effi stretch backlog

Use this list only after every acceptance check in `spec.md` passes. A working report-to-officer demo matters more than starting five extra features.

## Suggested order

### 1. Ask Effi for the selected case

Let an officer ask questions about one case. Answers must use only that case's messages, transcripts, evidence descriptions, and officer updates. Show the source behind each answer and return an explicit insufficient-evidence response when the case does not support an answer.

Why first: it strengthens the officer-intelligence pitch without changing the citizen reporting flow.

### 2. Citizen resolution verification

When an officer marks work complete, ask the original citizen whether the issue is resolved, unresolved, or partly resolved. Allow fresh text or photo evidence. Show the response to the officer, who keeps the final closure decision.

Why second: it gives Effi a clear closed loop that judges can understand quickly.

### 3. Video reporting

Accept video in the bots and citizen app, store it securely, transcribe speech when present, identify useful timestamps, and let officers play the relevant moments. Do not attempt cross-case video similarity.

Why third: it is visually strong, but media processing and playback can consume a full day by themselves.

### 4. Explainable duplicate and recurrence detection

Suggest reports that describe the same issue or repeated problems near the same location. Explain the matching signals and let an officer accept or reject the suggestion. Keep every citizen report as its own record.

### 5. Lightweight dashboard analytics

Add real counts and charts for new, active, and resolved cases plus cases by category and priority. Every chart must use Convex data and open the matching cases. Skip department-performance metrics and complex drill-downs.

### 6. Nearby-problem heat map

Show approximate issue areas, category, severity, and freshness. Never expose exact report coordinates, reporter identity, conversations, or evidence publicly.

### 7. Extended case communication

Allow officers to request more information from the citizen. Send the request through the original Telegram or WhatsApp conversation and attach the citizen's reply to the existing case. Add useful status notifications only after this reply path works.

### 8. Full citizen-app reporting parity

Turn the compact Expo report form into the same guided conversation used by the bots. Add persisted incomplete sessions, clarification questions, editable interpretation, manual map-pin selection, and richer case timelines.

### 9. Voice inside the citizen app

Add voice-note recording, transcription, language detection, and generated voice replies to Expo. Reuse the working bot speech providers and report rules. Telegram and WhatsApp voice are already part of Day 1 and do not wait for this item.

## Later product work

These features are valid ideas, but they should not enter the hackathon build unless the earlier stretch items are already stable.

- Advanced trends, average resolution time, recurrence analytics, and department-performance reporting
- Advanced geographic or root-cause clusters
- Multiple-reporter resolution voting
- Detailed closure-packet export
- Configurable retention, archival, and authorized deletion across messages, media, transcripts, and retrieval records
- Typed-address and landmark geocoding
- Automatic officer assignment and interdepartmental escalation
- SLA prediction and operational work-plan generation
- Shift briefings and handovers
- A live AI phone-call interface
- Multiple specialist agents coordinating on a case

## Production work

These changes improve safety and reliability but are poor uses of time before judging.

- Replace Baileys with an official WhatsApp integration
- Replace local file state and media directories with production storage
- Support multiple bot-gateway instances without duplicate sockets or messages
- Add monitoring, bounded redacted logs, provider budgets, and operator alerts
- Review model and speech-provider data controls before using real citizen information
- Add tested backup, recovery, deletion, and retention procedures

## Start gate

Do not start a stretch feature until all of these are true:

- Telegram and WhatsApp each create a real case and return the correct report ID.
- The dashboard displays the case and accepts one officer action.
- The citizen app creates and lists a real report.
- The complete demo has succeeded twice from a fresh start.

