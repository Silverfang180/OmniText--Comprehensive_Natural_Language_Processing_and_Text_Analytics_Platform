"""Authentication and API Key management Pydantic schemas."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    """Schema for user account registration."""

    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters.")


class UserResponse(BaseModel):
    """Schema for returning user info."""

    id: int
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """OAuth2-compatible token generation schema."""

    access_token: str
    token_type: str = "bearer"


class APIKeyCreateRequest(BaseModel):
    """Schema for creating a personal API Key."""

    name: str = Field(..., max_length=100, description="Friendly descriptive name for the API Key.")
    expires_in_days: int | None = Field(None, ge=1, description="Optional key expiration in days.")


class APIKeyCreateResponse(BaseModel):
    """Return representation showing the full plaintext token once at creation."""

    id: int
    name: str
    full_key: str
    created_at: datetime
    expires_at: datetime | None = None


class APIKeyResponse(BaseModel):
    """Standard API Key listing metadata, hiding the secret token."""

    id: int
    name: str
    prefix: str
    created_at: datetime
    expires_at: datetime | None = None

    class Config:
        from_attributes = True
