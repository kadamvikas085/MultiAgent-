"""Live AI Copilot endpoint.

The UI sends a natural-language question and receives an answer grounded in
recent catalog records and parsed source documents.

IMPORTANT:
- Gemini is used ONLY for the AI Copilot.
- The normal AI pipeline continues to use the existing LLM service.
- No API key is ever sent to the browser.
"""

from typing import Any
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.document import Document
from app.models.product import Product
from app.models.upload import Upload
from app.models.user import User

# IMPORTANT:
# Gemini is isolated to Copilot only.
from app.services.gemini_copilot_service import GeminiCopilotService


router = APIRouter(
    prefix="/copilot",
    tags=["AI Copilot"],
)


class CopilotRequest(BaseModel):
    question: str = Field(
        min_length=1,
        max_length=4000,
    )
    product_id: str | None = None


class CopilotResponse(BaseModel):
    answer: str
    sources: list[dict[str, Any]] = []


@router.post(
    "/query",
    response_model=CopilotResponse,
)
async def query_copilot(
    payload: CopilotRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Answer a Copilot question using catalog/document context."""

    # ------------------------------------------------------------
    # 1. Load product context
    # ------------------------------------------------------------

    product_query = (
        select(Product)
        .order_by(Product.updated_at.desc())
        .limit(8)
    )

    if payload.product_id:
        product_query = select(Product).where(
            Product.id == payload.product_id
        )

    products = list(
        (await db.scalars(product_query)).all()
    )

    # ------------------------------------------------------------
    # 2. Load user's uploaded document context
    # ------------------------------------------------------------

    documents = list(
        (
            await db.scalars(
                select(Document)
                .join(
                    Upload,
                    Upload.id == Document.upload_id,
                )
                .where(
                    Upload.user_id == current_user.id
                )
                .order_by(
                    Document.created_at.desc()
                )
                .limit(5)
            )
        ).all()
    )

    # ------------------------------------------------------------
    # 3. Build grounded context
    # ------------------------------------------------------------

    context_parts: list[str] = []
    sources: list[dict[str, Any]] = []

    for product in products:
        source = {
            "type": "product",
            "id": str(product.id),
            "title": product.name,
        }

        sources.append(source)

        context_parts.append(
            "PRODUCT SOURCE\n"
            + json.dumps(
                {
                    "name": product.name,
                    "sku": product.sku,
                    "category": product.category,
                    "description": product.description,
                    "specifications": product.specifications,
                    "technical_details": product.technical_details,
                    "confidence": product.confidence_score,
                    "status": (
                        product.status.value
                        if product.status
                        else None
                    ),
                },
                default=str,
            )
        )

    for document in documents:
        source = {
            "type": "document",
            "id": str(document.id),
            "title": (
                f"Parsed document "
                f"({document.page_count} pages)"
            ),
        }

        sources.append(source)

        context_parts.append(
            "DOCUMENT SOURCE\n"
            + (document.raw_text or "")[:6000]
        )

    context = "\n\n---\n\n".join(
        context_parts
    )[:30000]

    # ------------------------------------------------------------
    # 4. Copilot prompt
    # ------------------------------------------------------------

    prompt = f"""
You are IntelliSpec Copilot, an AI assistant for industrial
product intelligence.

Answer the user's question using ONLY the supplied
catalog/document context.

Rules:
- Do not invent information.
- If the context does not contain the answer, say so clearly.
- Be concise but useful.
- Mention uncertainty when a source has a low confidence score.
- Use the available product/document information as evidence.
- Do not expose API keys, credentials, or internal system details.

USER QUESTION:
{payload.question}

CONTEXT:
{context or "No catalog/document context is currently available."}
"""

    # ------------------------------------------------------------
    # 5. Gemini ONLY
    # ------------------------------------------------------------

    try:
        copilot_service = GeminiCopilotService()

        answer = await copilot_service.generate_text(
            prompt
        )

    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Copilot is unavailable: "
                f"{type(exc).__name__}: {exc}"
            ),
        ) from exc

    # ------------------------------------------------------------
    # 6. Return answer + grounded sources
    # ------------------------------------------------------------

    return CopilotResponse(
        answer=answer,
        sources=sources[:10],
    )