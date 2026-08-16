from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token, get_current_user
from app.db.session import AsyncSessionLocal, get_db
from app.models.ai_result import AIResult
from app.models.processing_job import ProcessingJob
from app.models.user import User
from app.schemas.pipeline import AgentResultRead, ProcessingJobRead
from app.websocket.manager import ws_manager

router = APIRouter(prefix="/pipeline", tags=["AI Processing Pipeline"])


@router.get("/jobs/{job_id}", response_model=ProcessingJobRead)
async def get_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = await db.get(ProcessingJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Processing job not found")
    return job


@router.get("/jobs/{job_id}/agent-results", response_model=list[AgentResultRead])
async def get_agent_results(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Powers the Explainable AI panel — shows each agent's confidence/output."""
    results = await db.scalars(
        select(AIResult).where(AIResult.processing_job_id == job_id)
    )
    # Explicitly validate each ORM row into the schema rather than relying on
    # response_model to do it implicitly — see AgentResultRead for why this
    # was 500ing before (from_attributes was missing there too).
    return [AgentResultRead.model_validate(r) for r in results]


async def _authenticate_ws(websocket: WebSocket) -> User | None:
    """Authenticate a WebSocket connection using the same JWT access token
    used by the REST API, passed as ?token=... (browsers can't set custom
    headers on WebSocket upgrade requests). Never logs the raw token."""
    token = websocket.query_params.get("token")
    if not token:
        return None
    try:
        payload = decode_token(token)
    except (JWTError, HTTPException):
        return None
    if payload.get("type") != "access":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
    if user is None or not user.is_active:
        return None
    return user


@router.websocket("/ws/{job_id}")
async def pipeline_ws(websocket: WebSocket, job_id: str):
    user = await _authenticate_ws(websocket)
    if user is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    async with AsyncSessionLocal() as db:
        job = await db.get(ProcessingJob, job_id)
    if job is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws_manager.connect(job_id, websocket)
    try:
        while True:
            # Client doesn't need to send anything; this just keeps the
            # connection open and detects disconnects.
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(job_id, websocket)


