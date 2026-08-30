"""Dependency Injection and Shared Security Helpers."""

from collections.abc import AsyncGenerator
from datetime import UTC, datetime

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from omnitext.core.security import decode_access_token, hash_api_key_secret
from omnitext.db.models import Analysis, APIKey, User
from omnitext.db.session import get_db_session

# OAuth2 scheme for session token extraction
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/token",
    auto_error=False,
)


async def db_session_dependency() -> AsyncGenerator[AsyncSession, None]:
    """Provide an asynchronous database session."""
    async for session in get_db_session():
        yield session


async def get_current_user(
    db: AsyncSession = Depends(db_session_dependency),
    token: str | None = Depends(oauth2_scheme),
    x_api_key: str | None = Header(None, alias="X-API-Key"),
) -> User:
    """Resolve user from session JWT token or Personal API Key."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1. Check for API Key authentication
    api_key_str = x_api_key or (token if token and token.startswith("ot_") else None)
    if api_key_str:
        if "." not in api_key_str:
            raise credentials_exception

        prefix, secret = api_key_str.split(".", 1)
        # Query API Key by prefix
        key_query = select(APIKey).where(APIKey.prefix == prefix)
        key_result = await db.execute(key_query)
        db_key = key_result.scalar_one_or_none()

        if not db_key:
            raise credentials_exception

        # Verify hashed secret
        hashed_secret = hash_api_key_secret(secret)
        if db_key.hashed_key != hashed_secret:
            raise credentials_exception

        # Check key expiration
        if db_key.expires_at and db_key.expires_at < datetime.now(UTC):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API Key has expired.",
            )

        # Retrieve owning user
        user_query = select(User).where(User.id == db_key.user_id)
        user_result = await db.execute(user_query)
        user = user_result.scalar_one_or_none()
        if not user:
            raise credentials_exception
        return user

    # 2. Check for Session JWT authentication
    if token:
        payload = decode_access_token(token)
        if not payload:
            raise credentials_exception

        email: str | None = payload.get("sub")
        if not email:
            raise credentials_exception

        jwt_query = select(User).where(User.email == email)
        jwt_result = await db.execute(jwt_query)
        jwt_user = jwt_result.scalar_one_or_none()
        if not jwt_user:
            raise credentials_exception
        return jwt_user

    raise credentials_exception


async def get_optional_user(
    db: AsyncSession = Depends(db_session_dependency),
    token: str | None = Depends(oauth2_scheme),
    x_api_key: str | None = Header(None, alias="X-API-Key"),
) -> User | None:
    """Optional user lookup for endpoints that support anonymous runs."""
    try:
        user = await get_current_user(db, token, x_api_key)
        return user
    except HTTPException:
        return None


async def get_user_analysis(
    analysis_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dependency),
) -> Analysis:
    """Resolve and authorize a saved analysis.

    Returns 404 for non-existent or unauthorized resources per Rules.md §7.
    """
    query = select(Analysis).where(Analysis.id == analysis_id)
    result = await db.execute(query)
    analysis = result.scalar_one_or_none()

    # 404 instead of 403 to avoid confirming existence to non-owner
    if not analysis or analysis.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found.",
        )

    return analysis
