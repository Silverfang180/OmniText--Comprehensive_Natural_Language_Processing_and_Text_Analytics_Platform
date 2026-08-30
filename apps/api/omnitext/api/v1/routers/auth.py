"""Authentication and API Key management router."""

from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from omnitext.api.v1.deps import db_session_dependency, get_current_user
from omnitext.api.v1.schemas.auth import (
    APIKeyCreateRequest,
    APIKeyCreateResponse,
    APIKeyResponse,
    TokenResponse,
    UserRegister,
    UserResponse,
)
from omnitext.api.v1.schemas.envelope import ResponseEnvelope, ResponseMeta
from omnitext.core.security import (
    create_access_token,
    generate_api_key_pair,
    hash_api_key_secret,
    hash_password,
    verify_password,
)
from omnitext.db.models import APIKey, User

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=ResponseEnvelope[UserResponse])
async def register_user(
    request_data: UserRegister,
    request: Request,
    db: AsyncSession = Depends(db_session_dependency),
) -> ResponseEnvelope[UserResponse]:
    """Register a new user account with secure password hashing."""
    request_id = getattr(request.state, "request_id", None)

    # Check if user already exists
    query = select(User).where(User.email == request_data.email)
    result = await db.execute(query)
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is already registered.",
        )

    # Hash password and save new user
    hashed_pwd = hash_password(request_data.password)
    new_user = User(email=request_data.email, hashed_password=hashed_pwd)
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    user_resp = UserResponse.model_validate(new_user)
    return ResponseEnvelope[UserResponse](
        data=user_resp,
        meta=ResponseMeta(request_id=request_id),
        error=None,
    )


@router.post("/token", response_model=TokenResponse)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(db_session_dependency),
) -> TokenResponse:
    """OAuth2 compatible token login, returning JWT access token."""
    query = select(User).where(User.email == form_data.username)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.email})
    return TokenResponse(access_token=access_token, token_type="bearer")


@router.post("/keys", response_model=ResponseEnvelope[APIKeyCreateResponse])
async def create_developer_api_key(
    key_data: APIKeyCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dependency),
) -> ResponseEnvelope[APIKeyCreateResponse]:
    """Generate a new personal developer API Key."""
    request_id = getattr(request.state, "request_id", None)

    prefix, secret, full_key = generate_api_key_pair()
    hashed_secret = hash_api_key_secret(secret)

    expires_at = None
    if key_data.expires_in_days:
        expires_at = datetime.now(UTC) + timedelta(days=key_data.expires_in_days)

    db_key = APIKey(
        user_id=current_user.id,
        name=key_data.name,
        prefix=prefix,
        hashed_key=hashed_secret,
        expires_at=expires_at,
    )
    db.add(db_key)
    await db.commit()
    await db.refresh(db_key)

    resp_data = APIKeyCreateResponse(
        id=db_key.id,
        name=db_key.name,
        full_key=full_key,
        created_at=db_key.created_at,
        expires_at=db_key.expires_at,
    )

    return ResponseEnvelope[APIKeyCreateResponse](
        data=resp_data,
        meta=ResponseMeta(request_id=request_id),
        error=None,
    )


@router.get("/keys", response_model=ResponseEnvelope[list[APIKeyResponse]])
async def list_active_api_keys(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dependency),
) -> ResponseEnvelope[list[APIKeyResponse]]:
    """List active personal API Keys for the logged in account."""
    request_id = getattr(request.state, "request_id", None)

    query = select(APIKey).where(APIKey.user_id == current_user.id).order_by(APIKey.created_at.desc())
    result = await db.execute(query)
    keys = result.scalars().all()

    resp_list = [APIKeyResponse.model_validate(k) for k in keys]

    return ResponseEnvelope[list[APIKeyResponse]](
        data=resp_list,
        meta=ResponseMeta(request_id=request_id),
        error=None,
    )


@router.delete("/keys/{key_id}", response_model=ResponseEnvelope[dict[str, Any]])
async def revoke_api_key(
    key_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dependency),
) -> ResponseEnvelope[dict[str, Any]]:
    """Revoke/Delete an active developer API Key."""
    request_id = getattr(request.state, "request_id", None)

    query = select(APIKey).where(APIKey.id == key_id)
    result = await db.execute(query)
    db_key = result.scalar_one_or_none()

    # Return 404 to avoid revealing key existence to unauthorized users
    if not db_key or db_key.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API Key not found.",
        )

    await db.delete(db_key)
    await db.commit()

    return ResponseEnvelope[dict[str, Any]](
        data={"success": True, "message": "API Key revoked successfully."},
        meta=ResponseMeta(request_id=request_id),
        error=None,
    )
