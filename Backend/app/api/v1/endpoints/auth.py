import pyotp
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.user import User, UserRole
from app.core.config import settings
from app.schemas.user import (
    OTPVerify,
    RefreshRequest,
    RegisterResponse,
    TokenPair,
    UserCreate,
    UserLogin,
    UserRead,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        otp_secret=pyotp.random_base32(),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # No email/SMS provider is wired up yet, so there's no real way to
    # deliver the OTP. DEV-ONLY FALLBACK: hand the current TOTP code back
    # in the response so the frontend can complete verification locally.
    # Remove dev_otp_code (and this branch) once a real provider exists —
    # never do this in production, it defeats the point of the OTP step.
    dev_otp_code = None
    if settings.APP_ENV == "development":
        dev_otp_code = pyotp.TOTP(user.otp_secret).now()

    return RegisterResponse(**UserRead.model_validate(user).model_dump(), dev_otp_code=dev_otp_code)


@router.post("/login", response_model=TokenPair)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Account not verified — check OTP")

    return TokenPair(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/verify-otp", response_model=TokenPair)
async def verify_otp(payload: OTPVerify, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == payload.email))
    if not user or not user.otp_secret:
        raise HTTPException(status_code=404, detail="User not found")

    totp = pyotp.TOTP(user.otp_secret)
    if not totp.verify(payload.otp_code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    user.is_verified = True
    await db.commit()

    return TokenPair(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest):
    data = decode_token(payload.refresh_token)
    if data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user_id = data["sub"]
    return TokenPair(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/dev/set-role", response_model=UserRead)
async def dev_set_role(
    role: UserRole,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    DEV-ONLY: lets the signed-in user switch their own role.

    There's no real role-assignment flow yet (e.g. an admin console or
    invite system) — every new signup defaults to ANALYST, which can't
    approve/reject in the Validation Center (that requires REVIEWER or
    ADMIN, see core/security.require_roles). This endpoint is a stand-in
    so the Validation Center is testable locally. Gated on
    APP_ENV == "development"; remove once real role management exists.
    """
    if settings.APP_ENV != "development":
        raise HTTPException(status_code=404, detail="Not found")

    current_user.role = role
    await db.commit()
    await db.refresh(current_user)
    return current_user


