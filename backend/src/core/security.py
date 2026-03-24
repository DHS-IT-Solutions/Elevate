"""
Security utilities for authentication and authorization.
Includes password hashing, token generation, and validation.
"""

import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from passlib.context import CryptContext
from jose import JWTError, jwt

from src.core.config import settings

# Configure logger
logger = logging.getLogger(__name__)

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class SecurityUtils:
    """Security utility functions."""

    @staticmethod
    def hash_password(password: str) -> str:
        logger.debug("Hashing password")
        try:
            hashed = pwd_context.hash(password)
            logger.debug("Password hashed successfully")
            return hashed
        except Exception as e:
            logger.error(f"Failed to hash password: {e}", exc_info=True)
            raise

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        logger.debug("Verifying password")
        try:
            result = pwd_context.verify(plain_password, hashed_password)
            if result:
                logger.debug("Password verification succeeded")
            else:
                logger.warning("Password verification failed: incorrect password")
            return result
        except Exception as e:
            logger.error(f"Error during password verification: {e}", exc_info=True)
            return False

    @staticmethod
    def generate_token(length: int = 32) -> str:
        logger.debug(f"Generating random token with length={length}")
        try:
            token = secrets.token_urlsafe(length)
            logger.debug("Token generated successfully")
            return token
        except Exception as e:
            logger.error(f"Failed to generate token: {e}", exc_info=True)
            raise

    @staticmethod
    def create_access_token(
        data: Dict[str, Any],
        expires_delta: Optional[timedelta] = None
    ) -> str:
        logger.debug(f"Creating access token for data keys: {list(data.keys())}")
        try:
            to_encode = data.copy()
            if expires_delta:
                expire = datetime.utcnow() + expires_delta
                logger.debug(f"Custom expiry set: {expire}")
            else:
                expire = datetime.utcnow() + timedelta(
                    minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
                )
                logger.debug(f"Default expiry set: {expire}")

            to_encode.update({"exp": expire})
            encoded_jwt = jwt.encode(
                to_encode,
                settings.SECRET_KEY,
                algorithm=settings.ALGORITHM
            )
            logger.info("Access token created successfully")
            return encoded_jwt
        except Exception as e:
            logger.error(f"Failed to create access token: {e}", exc_info=True)
            raise

    @staticmethod
    def verify_token(token: str) -> Optional[Dict[str, Any]]:
        logger.debug("Verifying JWT token")
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM]
            )
            logger.info("Token verified successfully")
            return payload
        except JWTError as e:
            logger.warning(f"JWT verification failed: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during token verification: {e}", exc_info=True)
            return None

    @staticmethod
    def validate_password_strength(password: str) -> tuple[bool, str]:
        logger.debug("Validating password strength")
        if len(password) < settings.MIN_PASSWORD_LENGTH:
            msg = f"Password must be at least {settings.MIN_PASSWORD_LENGTH} characters"
            logger.warning(f"Password validation failed: {msg}")
            return False, msg

        if settings.REQUIRE_UPPERCASE and not any(c.isupper() for c in password):
            msg = "Password must contain at least one uppercase letter"
            logger.warning(f"Password validation failed: {msg}")
            return False, msg

        if settings.REQUIRE_LOWERCASE and not any(c.islower() for c in password):
            msg = "Password must contain at least one lowercase letter"
            logger.warning(f"Password validation failed: {msg}")
            return False, msg

        if settings.REQUIRE_DIGIT and not any(c.isdigit() for c in password):
            msg = "Password must contain at least one digit"
            logger.warning(f"Password validation failed: {msg}")
            return False, msg

        if settings.REQUIRE_SPECIAL_CHAR and not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            msg = "Password must contain at least one special character"
            logger.warning(f"Password validation failed: {msg}")
            return False, msg

        logger.debug("Password passed all strength checks")
        return True, ""


# Singleton instance
security = SecurityUtils()