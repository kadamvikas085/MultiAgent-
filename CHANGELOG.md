# IntelliSpec update

This build includes:

- PaddleOCR protobuf compatibility pin (`protobuf==3.20.3`).
- Clear OCR fallback logging and safer PDF resource handling.
- Windows-friendly Celery defaults and documented `--pool=solo` worker command.
- Accurate global pipeline failure reporting: the actual current stage and error are persisted.
- Agent exceptions are no longer silently swallowed by BaseAgent.
- Stage-by-stage LangGraph progress streaming into the processing job/WebSocket.
- AIResult persistence now stores useful agent output for explainability.
- Celery task IDs are persisted on processing jobs.
- Live backend Copilot endpoint with document/product grounding.
- Frontend Copilot upgraded from scripted demo replies to the live backend endpoint.
- Copilot source badges, loading/error states, mobile-friendly composer, and responsive message layout.
- Responsive CSS hardening for narrow screens.
- CORS defaults include Vite 5173/5174.
- Cross-platform local upload directory default.
- OCR-only fixture PDF and smoke-test script.
- Expanded Windows setup/troubleshooting instructions.

## Validation performed

- Python `compileall` passed for `Backend/app`.
- Frontend dependency installation/build could not be completed in the packaging sandbox because the bundled `node_modules` contains permission-restricted files. The final ZIP intentionally excludes `node_modules`; run `npm install` on Windows before `npm run build`.
