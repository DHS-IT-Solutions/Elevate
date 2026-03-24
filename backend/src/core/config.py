"""
Core configuration management using Pydantic Settings.
Loads configuration from environment variables and .env file.
"""

from typing import List, Optional
from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field, PostgresDsn, RedisDsn, validator


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # ============================================
    # APPLICATION SETTINGS
    # ============================================
    APP_NAME: str = "Sage HR Platform"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # ============================================
    # DATABASE
    # ============================================
    DATABASE_URL: PostgresDsn
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 3600
    
    # ============================================
    # REDIS
    # ============================================
    REDIS_URL: RedisDsn
    REDIS_PASSWORD: Optional[str] = None
    REDIS_MAX_CONNECTIONS: int = 50
    
    # ============================================
    # KEYCLOAK
    # ============================================
    KEYCLOAK_SERVER_URL: str
    KEYCLOAK_REALM: str
    KEYCLOAK_CLIENT_ID: str
    KEYCLOAK_CLIENT_SECRET: str
    KEYCLOAK_PUBLIC_KEY: Optional[str] = None
    ALGORITHM: str = "RS256"
    
    # ============================================
    # JWT SETTINGS
    # ============================================
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # ============================================
    # SECURITY
    # ============================================
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000"] 
    ALLOWED_HOSTS: List[str] = ["localhost", "127.0.0.1"] 
    AWS_REGION: str = "us-east-1"
    
    MIN_PASSWORD_LENGTH: int = 12
    REQUIRE_UPPERCASE: bool = True
    REQUIRE_LOWERCASE: bool = True
    REQUIRE_DIGIT: bool = True
    REQUIRE_SPECIAL_CHAR: bool = True
    
    SESSION_TIMEOUT_MINUTES: int = 30
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_DURATION_MINUTES: int = 15
    
    # ============================================
    # CELERY
    # ============================================
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str
    
    # ============================================
    # EMAIL
    # ============================================
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@sageplatform.com"
    SMTP_FROM_NAME: str = "Sage HR Platform"
    
    # ============================================
    # STORAGE
    # ============================================
    STORAGE_TYPE: str = "local"  # local, minio, s3
    STORAGE_BUCKET: str = "sage-hr-documents"
    
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_SECURE: bool = False
    
    LOCAL_STORAGE_PATH: str = "./storage/uploads"
    
    # ============================================
    # LOGGING
    # ============================================
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # json or text
    LOG_FILE_PATH: str = "./logs/sage_hr.log"
    LOG_MAX_SIZE_MB: int = 100
    LOG_BACKUP_COUNT: int = 5
    
    # ============================================
    # API SETTINGS
    # ============================================
    API_PREFIX: str = "/api/v1"
    API_DOCS_ENABLED: bool = True
    API_DOCS_URL: str = "/docs"
    OPENAPI_URL: str = "/openapi.json"
    
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 60
    
    # ============================================
    # FEATURE FLAGS
    # ============================================
    ENABLE_MFA: bool = True
    ENABLE_SSO: bool = True
    ENABLE_AUDIT_TRAIL: bool = True
    ENABLE_EMAIL_NOTIFICATIONS: bool = True
    ENABLE_BACKGROUND_JOBS: bool = True
    
    # ============================================
    # MONITORING
    # ============================================
    SENTRY_DSN: Optional[str] = None
    SENTRY_ENVIRONMENT: str = "development"
    ENABLE_METRICS: bool = True
    METRICS_PORT: int = 9090
    
    # ============================================
    # DEVELOPMENT
    # ============================================
    RELOAD: bool = True
    SEED_FAKE_DATA: bool = False
    SKIP_AUTH_CHECK: bool = False
    
    @validator("ALLOWED_ORIGINS", pre=True)
    def parse_cors_origins(cls, v: str) -> List[str]:
        """Parse comma-separated CORS origins."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    @validator("ALLOWED_HOSTS", pre=True)
    def parse_allowed_hosts(cls, v: str) -> List[str]:
        """Parse comma-separated allowed hosts."""
        if isinstance(v, str):
            return [host.strip() for host in v.split(",")]
        return v
    
    class Config:
        """Pydantic configuration."""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.
    Using lru_cache ensures we create only one Settings instance.
    """
    return Settings()


# Global settings instance
settings = get_settings()