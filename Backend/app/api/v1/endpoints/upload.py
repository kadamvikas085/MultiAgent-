import ipaddress
import os
import socket
import uuid
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.processing_job import ProcessingJob
from app.models.upload import Upload, UploadStatus, UploadType
from app.models.user import User
from app.schemas.document import UploadCreateResponse, WebsiteIngestRequest
from app.workers.tasks import process_upload

router = APIRouter(prefix="/upload", tags=["Upload Center"])

EXTENSION_MAP = {
    ".pdf": UploadType.PDF,
    ".png": UploadType.IMAGE,
    ".jpg": UploadType.IMAGE,
    ".jpeg": UploadType.IMAGE,
    ".xlsx": UploadType.EXCEL,
    ".xls": UploadType.EXCEL,
    ".docx": UploadType.WORD,
    ".doc": UploadType.WORD,
}

MAX_BYTES = settings.MAX_UPLOAD_MB * 1024 * 1024


def _resolve_type(filename: str) -> UploadType:
    ext = os.path.splitext(filename.lower())[1]

    if ext not in EXTENSION_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file extension: {ext}",
        )

    return EXTENSION_MAP[ext]


def _is_blocked_ip(ip) -> bool:
    """
    Return True for IP addresses that must not be accessed by the
    server-side URL fetcher.

    This protects against basic SSRF attempts targeting:
      - localhost / loopback
      - private networks
      - link-local addresses
      - multicast
      - unspecified addresses
      - reserved addresses
    """

    # Handle IPv4-mapped IPv6 addresses such as ::ffff:127.0.0.1.
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped

    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_unspecified
        or ip.is_reserved
    )


def _validate_website_url(url: str) -> str:
    """
    Validate a website URL before it is stored and sent to the
    asynchronous processing pipeline.

    This is intentionally kept at the upload boundary so the existing
    OCR, extraction, validation, knowledge graph, reasoning and frontend
    pipeline remain unchanged.
    """

    if not url or not url.strip():
        raise HTTPException(
            status_code=400,
            detail="Website URL is required.",
        )

    url = url.strip()

    try:
        parsed = urlparse(url)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid website URL.",
        ) from exc

    # Only normal web URLs are accepted.
    if parsed.scheme.lower() not in {"http", "https"}:
        raise HTTPException(
            status_code=400,
            detail="Only http:// and https:// URLs are allowed.",
        )

    # A hostname is mandatory.
    hostname = parsed.hostname

    if not hostname:
        raise HTTPException(
            status_code=400,
            detail="Website URL must contain a valid hostname.",
        )

    hostname = hostname.rstrip(".").lower()

    # Prevent URLs containing embedded credentials.
    if parsed.username is not None or parsed.password is not None:
        raise HTTPException(
            status_code=400,
            detail="URLs containing username or password credentials are not allowed.",
        )

    # Explicit localhost names.
    blocked_hostnames = {
        "localhost",
        "localhost.localdomain",
        "ip6-localhost",
        "ip6-loopback",
    }

    if hostname in blocked_hostnames or hostname.endswith(".localhost"):
        raise HTTPException(
            status_code=400,
            detail="Access to localhost is not allowed.",
        )

    # First check whether the hostname itself is an IP address.
    try:
        direct_ip = ipaddress.ip_address(hostname)
    except ValueError:
        direct_ip = None

    if direct_ip is not None:
        if _is_blocked_ip(direct_ip):
            raise HTTPException(
                status_code=400,
                detail="Access to private or internal IP addresses is not allowed.",
            )

        return url

    # Resolve DNS and validate every returned address.
    #
    # This prevents a hostname such as:
    # attacker.example -> 127.0.0.1
    #
    # from bypassing the basic IP checks.
    try:
        addr_info = socket.getaddrinfo(
            hostname,
            parsed.port or (443 if parsed.scheme.lower() == "https" else 80),
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as exc:
        raise HTTPException(
            status_code=400,
            detail="The website hostname could not be resolved.",
        ) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=400,
            detail="The website hostname could not be resolved.",
        ) from exc

    resolved_ips = set()

    for entry in addr_info:
        sockaddr = entry[4]

        if not sockaddr:
            continue

        resolved_ip = sockaddr[0]

        try:
            ip = ipaddress.ip_address(resolved_ip)
        except ValueError:
            continue

        resolved_ips.add(str(ip))

        if _is_blocked_ip(ip):
            raise HTTPException(
                status_code=400,
                detail="The website hostname resolves to a private or internal IP address.",
            )

    if not resolved_ips:
        raise HTTPException(
            status_code=400,
            detail="The website hostname did not resolve to a valid IP address.",
        )

    return url


async def _create_upload_and_queue(
    db: AsyncSession,
    user: User,
    file_name: str,
    file_type: UploadType,
    storage_path: str,
    file_size: int,
    source_url: str | None = None,
) -> UploadCreateResponse:
    upload = Upload(
        user_id=user.id,
        file_name=file_name,
        file_type=file_type,
        file_size_bytes=file_size,
        storage_path=storage_path,
        source_url=source_url,
        status=UploadStatus.VALIDATING,
    )

    db.add(upload)
    await db.flush()

    job = ProcessingJob(upload_id=upload.id)
    db.add(job)

    await db.commit()
    await db.refresh(upload)
    await db.refresh(job)

    result = process_upload.delay(str(upload.id), str(job.id))

    job.celery_task_id = result.id

    await db.commit()

    return UploadCreateResponse(
        id=upload.id,
        file_name=upload.file_name,
        file_type=upload.file_type,
        status=upload.status,
        processing_job_id=job.id,
    )


@router.post("/file", response_model=UploadCreateResponse)
async def upload_file(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    file_type = _resolve_type(file.filename)

    contents = await file.read()

    if len(contents) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail="File exceeds max upload size",
        )

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    unique_name = f"{uuid.uuid4()}_{file.filename}"
    storage_path = os.path.join(
        settings.UPLOAD_DIR,
        unique_name,
    )

    with open(storage_path, "wb") as f:
        f.write(contents)

    return await _create_upload_and_queue(
        db,
        current_user,
        file.filename,
        file_type,
        storage_path,
        len(contents),
    )


@router.post("/website", response_model=UploadCreateResponse)
async def ingest_website(
    payload: WebsiteIngestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # ---------------------------------------------------------------
    # SSRF PROTECTION
    # ---------------------------------------------------------------
    # Validate the URL BEFORE creating the Upload/ProcessingJob.
    #
    # Everything after this point remains the same as the existing
    # working URL pipeline.
    # ---------------------------------------------------------------
    validated_url = _validate_website_url(payload.url)

    return await _create_upload_and_queue(
        db,
        current_user,
        file_name=validated_url,
        file_type=UploadType.WEBSITE,
        storage_path=validated_url,
        file_size=0,
        source_url=validated_url,
    )