import uuid

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class OTPVerify(BaseModel):
    email: EmailStr
    otp_code: str = Field(min_length=6, max_length=6)


class UserRead(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool
    is_verified: bool
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


class RegisterResponse(UserRead):
    """
    Same as UserRead, plus an optional dev_otp_code field.

    dev_otp_code is populated ONLY when settings.APP_ENV == "development",
    as a stand-in for a real email/SMS OTP delivery provider, which this
    project does not yet integrate. Never set in production — see
    core/config.py (APP_ENV) and api/v1/endpoints/auth.py (register).
    """

    dev_otp_code: str | None = None


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


