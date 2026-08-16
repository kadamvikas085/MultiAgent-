"""
Shared state object threaded through the LangGraph pipeline.
Every agent node reads from and writes partial updates back into this dict.
"""
from typing import Any, Optional, TypedDict


class PipelineState(TypedDict, total=False):
    # --- Identifiers ---
    upload_id: str
    processing_job_id: str
    document_id: Optional[str]

    # --- Raw inputs ---
    file_path: str
    file_type: str  # pdf | image | excel | word | website
    source_url: Optional[str]

    # --- OCR / parsing stage ---
    raw_text: str
    tables: list[dict]
    layout_metadata: dict
    ocr_confidence: float

    # --- Extraction stage ---
    extracted_fields: dict[str, Any]

    # --- Validation stage ---
    validation_flags: list[dict]
    conflicts: list[dict]

    # --- Reasoning / RAG stage ---
    retrieved_context: list[dict]
    reasoning_output: dict

    # --- Knowledge graph stage ---
    kg_nodes: list[dict]
    kg_edges: list[dict]

    # --- SEO stage ---
    seo_metadata: dict

    # --- Recommendation stage ---
    related_product_ids: list[str]

    # --- Compliance stage ---
    compliance_flags: list[dict]

    # --- QA / confidence stage ---
    field_confidence: dict[str, float]
    overall_confidence: float
    requires_human_review: bool

    # --- Final output ---
    generated_product: dict

    # --- Bookkeeping ---
    agent_logs: list[dict]
    errors: list[str]


