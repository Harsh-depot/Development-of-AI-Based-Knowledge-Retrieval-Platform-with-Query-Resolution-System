"""
security.py — JWT Authentication & Password Hashing Utilities
=============================================================
Provides password hashing via bcrypt and JWT token generation/validation.
All functions are pure utilities; FastAPI dependency injection is in main.py.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from passlib.context import CryptContext

from config import settings

# ---------------------------------------------------------------------------
# Password Hashing
# ---------------------------------------------------------------------------

# bcrypt context — automatically handles salting
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against its bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


# ---------------------------------------------------------------------------
# JWT Token Management
# ---------------------------------------------------------------------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Encode a JWT access token.

    Args:
        data: Payload dict (must include 'sub' claim = user_id string).
        expires_delta: Override token lifetime; defaults to settings value.

    Returns:
        Signed JWT string.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta
        else timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decode and validate a JWT access token.

    Args:
        token: JWT string from Authorization header.

    Returns:
        Decoded payload dict.

    Raises:
        jwt.ExpiredSignatureError: Token has expired.
        jwt.InvalidTokenError: Token signature or format is invalid.
    """
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )
