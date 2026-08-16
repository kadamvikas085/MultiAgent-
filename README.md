# UNIhack

One-line description: A multi-agent document intelligence platform with RAG, knowledge graph, OCR, and human-in-the-loop validation.

![Build Status](https://img.shields.io/badge/build-passing-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

## Project Overview

UNIhack is an end-to-end platform that ingests documents, extracts structured knowledge, and answers queries using retrieval-augmented generation (RAG), knowledge graph representations, and multi-agent orchestration. It combines OCR, LLMs, vector search, and reasoning agents to enable robust document intelligence workflows.

## Problem Statement

Organizations need reliable, explainable, and auditable systems to extract actionable knowledge from heterogeneous documents (PDFs, images, scanned forms) and serve this knowledge to search, analytics, and downstream automation.

## Solution

UNIhack provides a modular pipeline: document ingestion → OCR → embedding + vector store → RAG retrieval → multi-agent reasoning and validation → knowledge graph storage and API access. Human-in-the-loop validation and confidence scoring ensure accuracy and auditability.

## Key Features

- Multi-agent orchestration for specialized tasks (extraction, validation, reasoning, recommendations).
- RAG-based Q&A with vector search for factual grounding.
- Knowledge graph construction and query interface.
- Document OCR and vision-language model integration for images.
- Human-in-the-loop review and confidence scoring.
- REST API and frontend demo app.

## Official Requirements → Implementation Mapping

- Requirement: Document ingestion and OCR → Implementation: `Backend/app/services/ocr_service.py` and `Backend/app/api/v1/endpoints/upload.py` ([link](Backend/app/services/ocr_service.py#L1), [link](Backend/app/api/v1/endpoints/upload.py#L1)).
- Requirement: Vector search and RAG → Implementation: `Backend/app/services/vector_store_service.py`, `Backend/app/services/llm_service.py` ([link](Backend/app/services/vector_store_service.py#L1), [link](Backend/app/services/llm_service.py#L1)).
- Requirement: Knowledge graph → Implementation: `Backend/app/services/graph_db_service.py` and `Backend/app/graphs/pipeline_graph.py` ([link](Backend/app/services/graph_db_service.py#L1), [link](Backend/app/graphs/pipeline_graph.py#L1)).
- Requirement: Multi-agent orchestration → Implementation: `Backend/app/agents/*.py` ([link](Backend/app/agents/__init__.py#L1)).
- Requirement: Frontend demo → Implementation: `Frontend/app/src/App.jsx` ([link](Frontend/app/src/App.jsx#L1)).

## System Architecture

The system is split into:
- Frontend: React + Vite demo app (`Frontend/app`).
- Backend: FastAPI (or similar) app (`Backend/app`).
- Services: OCR, LLM, Vector Store, Graph DB, Celery workers for async tasks.
- Storage: Relational DB for metadata, Vector DB for embeddings, Graph DB for knowledge graph.

Refer to `Backend/app/main.py` for the API entrypoint ([link](Backend/app/main.py#L1)).

## Multi-Agent Architecture

Each agent is implemented as a focused component under `Backend/app/agents/`:

- Extraction Agent: extracts entities and structured data from OCR output.
- Validation Agent: human-in-the-loop and rule-based checks.
- Reasoning Agent: composes evidence and crafts LLM prompts.
- Recommendation Agent: suggests actions based on extracted knowledge.
- SEO / QA / Compliance Agents: domain-specific behaviors.

See `Backend/app/agents` for concrete implementations ([link](Backend/app/agents/__init__.py#L1)).

## Agent Responsibilities

- `extraction_agent.py`: parse text → entities → schema.
- `validation_agent.py`: check confidence → request human review.
- `knowledge_graph_agent.py`: ingest triples into graph DB.
- `qa_agent.py`: perform RAG retrieval and answer generation.
- `reasoning_agent.py`: chain-of-thought synthesis for complex queries.

## Technology Stack

- Backend: Python, FastAPI (or Starlette), Celery.
- Frontend: React, Vite, Tailwind CSS.
- LLMs: OpenAI / local LLMs via the `llm_service`.
- Vector DB: (e.g., FAISS, Milvus, Pinecone) via `vector_store_service`.
- Graph DB: Neo4j or RDF store via `graph_db_service`.
- DB: PostgreSQL (SQLAlchemy models in `Backend/app/models`).
- Containerization: Docker.

## Project Structure

- Backend/
  - `app/` — application code (agents, api, services, models, schemas)
  - `alembic/` — DB migrations
  - `requirements.txt`, `Dockerfile`
- Frontend/
  - `app/` — React demo app (`Frontend/app/src/App.jsx`)

See the repository files for details.

## Data Flow / Pipeline

1. Upload document via API (`/upload`).
2. OCR extracts text and layout.
3. Extraction agent parses entities and schemas.
4. Generate embeddings and store in vector DB.
5. Build/augment knowledge graph.
6. Index metadata in relational DB.
7. Query path: RAG retrieval → reasoning agent → validation agent → response.

## RAG Implementation

- Retriever: nearest-neighbor search over embeddings (see `vector_store_service.py`).
- Generator: LLM prompts composed by `llm_service.py` using retrieved passages as context.
- Answer augmentation: chain-of-evidence from agents and KG.

## Knowledge Graph Implementation

- Triples generated by `knowledge_graph_agent.py` and persisted via `graph_db_service.py`.
- Node/edge schema stored in `Backend/app/models/knowledge_graph.py` ([link](Backend/app/models/knowledge_graph.py#L1)).

## Document Intelligence / OCR

- OCR performed by `ocr_service.py`. Supports Tesseract, AWS Textract, or commercial OCR providers via configuration.
- Layout-aware extraction for tables, fields, and forms.

## Vision-Language Model

- Integrates optional vision-language models for image understanding and diagram parsing. Hooked into the same `llm_service` abstraction for generation.

## Human-in-the-Loop Validation

- Validation agent flags low-confidence items and routes them to a simple review UI or an audit queue (`audit_log` models and schemas).

## Confidence Scoring & Explainability

- Confidence scores computed from model logits, retrieval similarity, and rule checks.
- Audit logs capture agent decisions (`Backend/app/audit_log`).

## Database Architecture

- SQLAlchemy models live in `Backend/app/models/` and include `document`, `product`, `user`, `ai_result`, and `knowledge_graph`.
- Migrations with Alembic (`alembic/`).

## API Documentation

- The backend exposes REST endpoints under `Backend/app/api/v1/` (see `api.py` and `endpoints/`). Example endpoints: upload, search, products, pipeline, validation.

## Frontend

- Demo frontend in `Frontend/app/` built with React + Vite. Entry: `Frontend/app/src/App.jsx` ([link](Frontend/app/src/App.jsx#L1)).

## Backend

- Backend app entrypoint: `Backend/app/main.py` ([link](Backend/app/main.py#L1)).
- Services for embedding, LLM, OCR, and graph operations under `Backend/app/services/`.

## Environment Variables

Required (examples):

- `DATABASE_URL` — SQL database connection string.
- `VECTOR_DB_URL` — vector database connection.
- `GRAPH_DB_URL` — graph database connection.
- `OPENAI_API_KEY` — LLM provider key (or other provider creds).
- `OCR_PROVIDER` — e.g., `tesseract`/`textract`.

Store env vars in a `.env` file or your deployment secrets manager.

## Installation

Backend (Python):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r Backend/requirements.txt
```

Frontend (node):

```bash
cd Frontend/app
npm install
npm run dev
```

## Running the Project

- Start backend (example):

```powershell
uvicorn Backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

- Start workers (example):

```powershell
celery -A Backend.app.core.celery_app worker --loglevel=info
```

## Docker / Infrastructure

- A `Backend/Dockerfile` is included for containerizing the backend. Use `docker-compose` to wire DBs and vector/graph services.

## Example Workflow

1. User uploads a PDF to `/api/v1/upload`.
2. OCR service extracts text and returns structured result.
3. Extraction agent produces entities and triples.
4. Embeddings are generated and stored.
5. Knowledge graph is updated and available for queries.
6. User queries via `/api/v1/search`; QA agent runs RAG and returns an answer with provenance.

## Example Output

- Returned JSON includes: `answer`, `sources` (IDs and snippets), `confidence`, `explainability` (agent traces), and `audit_id` for human review.

## Evaluation Metrics

- OCR accuracy (CER/WER), extraction precision/recall, retrieval MRR/Recall@k, answer factuality (human eval), validation throughput, and system latency.

## Security

- Secrets via env vars or secret manager; restrict access to APIs; validate and sanitize uploaded files; audit logging for sensitive operations.

## Scalability

- Scale vector DB and graph DB horizontally; run multiple worker replicas; use async processing and batching for embeddings/OCR.

## Limitations

- LLM hallucinations require careful prompt engineering and validation.
- OCR quality depends on source image quality.

## Future Enhancements

- Add more prebuilt connectors for enterprise services.
- Improve active learning loop for validation.
- Add role-based access and fine-grained provenance UI.

## Screenshots

Add UI screenshots under `docs/screenshots/` and reference them here.

## Contributors

- See the git history. Key modules: `Backend/app/agents`, `Backend/app/services`, `Frontend/app/src`.

## License

This project is licensed under the MIT License. See `LICENSE`.


## Windows local runbook (recommended)

### 1. Start all infrastructure

From the repository root:

```powershell
docker compose -f docker-compose.dev.yml up -d
docker ps
```

The pipeline needs PostgreSQL and Redis for upload/job processing, plus Qdrant and Neo4j for the RAG/knowledge-graph stages.

### 2. Configure Backend/.env

Copy `.env.example` to `.env` and set a real `OPENAI_API_KEY`.

Never commit the real key or include it in a ZIP. Use `.env.example` for distribution.

### 3. Install Python dependencies

```powershell
cd Backend
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pip check
```

PaddleOCR is pinned to a compatible protobuf version:

```text
protobuf==3.20.3
```

Verify OCR before uploading anything:

```powershell
python -c "import google.protobuf; print(google.protobuf.__version__)"
python -c "from paddleocr import PaddleOCR; print('PaddleOCR import OK'); PaddleOCR(use_angle_cls=True, lang='en', show_log=False); print('PaddleOCR initialized OK')"
```

### 4. Run the API

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 5. Run Celery on Windows

Open a second PowerShell window:

```powershell
cd "C:\IMPStudy\intellispec\Backend"
.\venv\Scripts\Activate.ps1
celery -A app.core.celery_app.celery_app worker --loglevel=info --pool=solo
```

The worker should finish with:

```text
celery@... ready.
```

### 6. Run the frontend

Open a third PowerShell window:

```powershell
cd "C:\IMPStudy\intellispec\Frontend\app"
npm install
npm run dev
```

Vite may select 5174 if 5173 is already occupied; the frontend proxy works with both ports.

### 7. OCR test

Use an image-only/scanned PDF. A text-native PDF will intentionally use the faster PyMuPDF path and will not invoke PaddleOCR.

Expected sequence:

```text
Upload
→ processing_jobs row
→ Celery process_upload
→ OCR RUNNING
→ PaddleOCR fallback (for image-only PDF)
→ OCR SUCCEEDED
→ Document Parsing
→ Extraction
→ Validation
→ RAG / Reasoning
→ Knowledge Graph
→ Generation / Enrichment
→ Confidence Scoring
→ Human Review or Completed
```

### Troubleshooting

- `ModuleNotFoundError: pyotp`: activate the Backend virtual environment and install `requirements.txt`.
- `Descriptors cannot be created directly`: reinstall/pin `protobuf==3.20.3`.
- `PermissionError [WinError 5]` from billiard/Celery: stop old workers and use `--pool=solo`.
- `No module named package.json`: run npm commands from `Frontend\app`, not `Frontend`.
- Pipeline fails at RAG: verify Qdrant is running on port 6333.
- Pipeline fails at Knowledge Graph: verify Neo4j is running on port 7687 and credentials match `.env`.
- Pipeline fails at an AI stage with a missing-key error: set `OPENAI_API_KEY` in `Backend/.env`.
- The API now persists the actual failed pipeline stage and error message instead of always labeling failures as OCR.
