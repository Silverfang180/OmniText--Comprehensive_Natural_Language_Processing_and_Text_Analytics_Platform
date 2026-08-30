"""Security Utility Functions for password hashing and authentication tokens."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from omnitext.core.config import settings


def hash_password(password: str) -> str:
    """Generate a secure salted bcrypt hash of a password."""
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain text password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except ValueError:
        return False


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """Create a signed JWT access token for authentication sessions."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decode a signed JWT access token. Returns claims if valid."""
    try:
        decoded = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if isinstance(decoded, dict):
            return decoded
        return None
    except jwt.PyJWTError:
        return None


def generate_api_key_pair() -> tuple[str, str, str]:
    """Generate a prefix, secret, and full API key string representation."""
    prefix = f"ot_{secrets.token_hex(4)}"
    secret = secrets.token_urlsafe(32)
    full_key = f"{prefix}.{secret}"
    return prefix, secret, full_key


def hash_api_key_secret(secret: str) -> str:
    """Securely hash the secret token portion of an API key using SHA-256."""
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()
