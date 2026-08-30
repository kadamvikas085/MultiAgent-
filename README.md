# IntelliSpec — Multi-Agent Product Intelligence Platform

> An AI-powered multi-agent platform for extracting, validating, reasoning over, and organizing product intelligence from heterogeneous technical documents.

IntelliSpec transforms unstructured technical documents into structured, evidence-backed product intelligence using OCR, LLMs, RAG, vector search, and knowledge graphs.

The platform combines a multi-agent document processing pipeline with confidence-based validation and an interactive web dashboard, enabling users to move from raw documents to searchable and explainable product insights.


## Overview

Technical product information is often distributed across PDFs, specification sheets, catalogs, scanned documents, and other heterogeneous sources.

IntelliSpec automates this process by:

- Extracting information from technical documents
- Structuring product specifications
- Performing reasoning and validation
- Assigning confidence scores
- Routing uncertain results for human review
- Building a knowledge graph of products and relationships
- Providing semantic and vector search
- Generating AI-powered product insights
- Maintaining source provenance for extracted information

The result is a unified product intelligence system that combines automation, explainability, and human validation.


## Key Features

### Multi-Agent Document Intelligence

A multi-agent pipeline processes uploaded documents through specialized stages:

1. Extraction Agent — extracts structured product information.
2. Reasoning Agent — interprets and derives meaningful relationships from extracted information.
3. Validation Agent — checks extracted information and assigns confidence.
4. Knowledge Graph Agent — converts validated information into graph-based relationships.

Additional agents support capabilities such as:

- Question answering
- Product recommendations
- Compliance analysis
- SEO-oriented product content
- Product intelligence workflows


### Document Processing

Supports processing of heterogeneous technical documents using:

- OCR
- Text extraction
- Document parsing
- Structured information extraction
- Source-aware processing

Extracted information can include:

- Product name
- SKU
- Category
- Description
- Technical specifications
- Applications
- Technical details
- Confidence scores


### Retrieval-Augmented Generation

IntelliSpec combines structured product data with retrieval mechanisms to provide grounded AI responses.

The system uses:

- Vector embeddings
- Semantic search
- Qdrant vector database
- Retrieved document/product context
- Source-aware prompting

This allows generated responses to be grounded in available product and document information rather than relying solely on model knowledge.


### Knowledge Graph

Validated product information is represented as a graph using Neo4j.

Example relationship structure:

Product
   |
   +-- BELONGS_TO --> Category
   |
   +-- USED_FOR ----> Application

The platform includes an interactive Knowledge Graph explorer for visualizing product relationships.


### AI Copilot

The platform includes a conversational AI Copilot that allows users to ask natural-language questions about product and document information.

The Copilot:

- Uses catalog and document context
- Provides grounded answers
- Returns source information
- Avoids unsupported claims
- Can indicate uncertainty
- Keeps API credentials on the backend

Gemini is isolated specifically for the Copilot service.


### Confidence-Based Human Review

Not every extracted result should be automatically accepted.

IntelliSpec uses confidence scores to support a human-in-the-loop workflow:

Document
    |
    v
Extraction
    |
    v
Reasoning
    |
    v
Validation
    |
    +-- High confidence --> Accepted
    |
    +-- Low confidence ---> Human Review Queue


## System Architecture

                         +---------------------+
                         |      Frontend       |
                         |   React Dashboard   |
                         +----------+----------+
                                    |
                                    v
                         +---------------------+
                         |      FastAPI        |
                         |      REST APIs      |
                         +----------+----------+
                                    |
              +---------------------+---------------------+
              |                     |                     |
              v                     v                     v
       +--------------+      +--------------+      +--------------+
       | Multi-Agent  |      |  AI Copilot  |      | Knowledge    |
       | Pipeline     |      |   Service    |      | Graph        |
       +------+-------+      +------+-------+      +------+-------+
              |                     |                     |
              v                     v                     v
       +--------------+      +--------------+      +--------------+
       | LLM / Mock   |      | Gemini       |      | Neo4j        |
       | LLM          |      | 2.5 Flash    |      |              |
       +--------------+      +--------------+      +--------------+
              |
              v
       +--------------+
       | Qdrant       |
       | Vector Search|
       +------+-------+
              |
              v
       +--------------+
       | PostgreSQL   |
       | Structured   |
       | Data         |
       +--------------+


## Technology Stack

### Frontend

- React
- Vite
- JavaScript / JSX
- Responsive dashboard UI

### Backend

- Python
- FastAPI
- SQLAlchemy
- Pydantic
- Async programming

### AI / ML

- Large Language Models
- Gemini
- OCR
- RAG
- Vector embeddings
- Confidence-based validation

### Databases

- PostgreSQL — structured application data
- Qdrant — vector search and embeddings
- Neo4j — knowledge graph

### Background Processing

- Celery
- Redis

### Infrastructure

- Docker
- Docker Compose
- Alembic


## Project Structure

intellispec/
|
+-- Backend/
|   +-- app/
|   |   +-- agents/
|   |   +-- api/
|   |   +-- core/
|   |   +-- db/
|   |   +-- graphs/
|   |   +-- models/
|   |   +-- schemas/
|   |   +-- services/
|   |   +-- websocket/
|   |   +-- workers/
|   |
|   +-- alembic/
|   +-- Dockerfile
|   +-- requirements.txt
|
+-- Frontend/
|   +-- app/
|       +-- src/
|       +-- public/
|       +-- package.json
|       +-- vite.config.js
|
+-- docker-compose.dev.yml
+-- docker-compose.prod.yml
+-- .env.production.example
+-- .gitignore
+-- CHANGELOG.md
+-- README.md


## Getting Started

### Prerequisites

Make sure the following are installed:

- Python 3.11+
- Node.js 18+
- npm
- PostgreSQL
- Redis
- Qdrant
- Neo4j
- Git

Docker can be used to simplify infrastructure setup.


## Backend Setup

Navigate to the backend:

    cd Backend

Create a virtual environment:

    python -m venv venv

Activate it on Windows:

    .\venv\Scripts\Activate.ps1

Install dependencies:

    pip install -r requirements.txt

Create your environment file:

    Copy-Item .env.example .env

Update .env with your local configuration.

NEVER commit the .env file.

Start the backend:

    uvicorn app.main:app --reload

The API will be available at:

    http://localhost:8000


## Frontend Setup

Open another terminal:

    cd Frontend/app

Install dependencies:

    npm install

Start the development server:

    npm run dev

The frontend will normally be available at:

    http://localhost:5173


## Celery Worker

From the Backend directory:

    celery -A app.core.celery_app.celery_app worker --loglevel=info --pool=solo

Celery uses Redis as the message broker and result backend according to the configured environment variables.


## Docker

Development services can be started using:

    docker compose -f docker-compose.dev.yml up --build

To stop the services:

    docker compose -f docker-compose.dev.yml down


## Environment Variables

Create a local .env file from:

    Backend/.env.example

For production configuration, refer to:

    .env.production.example

Important security rule:

NEVER commit:

- .env
- API keys
- Private keys
- Database passwords
- Credentials
- Service-account files
- Production secrets

The repository includes a .gitignore configured to prevent sensitive and generated files from being committed.


## AI Configuration

### Main AI Pipeline

The main document-processing pipeline can run using the mock LLM service for development and testing:

    USE_MOCK_LLM=true

This allows the pipeline to run without consuming external LLM API usage.

### AI Copilot

The AI Copilot uses Gemini independently from the main pipeline.

Example configuration:

    GEMINI_API_KEY=your_key_here
    GEMINI_MODEL=gemini-2.5-flash

The real API key should only exist in the local or deployed environment.

Never place the Gemini API key in frontend source code or commit it to Git.


## API

The backend exposes REST APIs for capabilities including:

- Authentication
- Document processing
- Product management
- Analytics
- AI Copilot
- Knowledge Graph
- Audit information
- Export workflows

Interactive API documentation is available through FastAPI's generated documentation when running in development mode.


## Knowledge Graph

The Knowledge Graph Explorer reads product relationships from Neo4j.

Example:

Product
   |
   +-- BELONGS_TO --> Industrial Components
   |
   +-- USED_FOR ----> General Industrial Use

The frontend provides interactive graph exploration with:

- Node visualization
- Relationship visualization
- Hover and focus interactions
- Zoom
- Pan
- Node details
- Relationship information


## Human Review Workflow

Confidence scores are used to determine whether extracted information requires additional review.

                  Technical Document
                         |
                         v
                    OCR / Parsing
                         |
                         v
                    Extraction
                         |
                         v
                     Reasoning
                         |
                         v
                    Validation
                         |
                +--------+--------+
                |                 |
         High Confidence    Low Confidence
                |                 |
                v                 v
             Accepted         Review Queue
                |                 |
                +--------+--------+
                         |
                         v
                  Knowledge Graph


## Security

Security considerations include:

- Environment-based secret management
- No API keys in frontend code
- .env excluded through .gitignore
- Separate configuration for development and production
- Authentication-protected APIs
- Backend-only access to external LLM credentials

Never expose API keys in:

- Source code
- Git history
- Screenshots
- Documentation
- Public repositories


## Development

Run frontend and backend separately during development.

### Backend

    cd Backend
    uvicorn app.main:app --reload

### Frontend

    cd Frontend/app
    npm run dev

### Celery

    cd Backend
    celery -A app.core.celery_app.celery_app worker --loglevel=info --pool=solo


## Production Considerations

Before deploying publicly:

- Use strong production secrets
- Use managed/private databases
- Configure production CORS origins
- Disable development debugging
- Store API keys in a secure secret manager
- Configure HTTPS
- Restrict database access
- Configure Redis securely
- Monitor API and worker usage
- Review authentication and authorization
- Review uploaded document handling


## Project Highlights

- Multi-agent AI document processing
- OCR-based document understanding
- Structured product information extraction
- Retrieval-Augmented Generation
- Vector search with Qdrant
- Knowledge Graph construction with Neo4j
- FastAPI REST APIs
- PostgreSQL-backed application data
- Celery + Redis background processing
- Confidence-based human review
- Source-aware AI responses
- Interactive React dashboard
- Dedicated Gemini AI Copilot
- Docker-based infrastructure


## Future Improvements

Potential future enhancements include:

- Advanced document chunking and retrieval
- Improved citation-level provenance
- More sophisticated graph reasoning
- Automated evaluation of extraction quality
- Model observability and tracing
- Role-based access control
- Cloud-native deployment
- Scalable document processing
- Improved mobile experience
- Expanded automated test coverage


## Author

Vikas Kadam

B.Tech — Computer Science Engineering

Interests:

- Full-Stack Development
- Artificial Intelligence
- Machine Learning
- Multi-Agent Systems
- RAG
- Knowledge Graphs


## License

This project is currently intended as a portfolio/prototype project.

Add an explicit open-source license if you decide to release the source under one.