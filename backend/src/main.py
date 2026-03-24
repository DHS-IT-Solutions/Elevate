"""
Main FastAPI application entry point.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import time

from src.core.config import settings
from src.core.database import init_db, dispose_db

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("main")


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== Starting %s ===", settings.APP_NAME)
    logger.info("Environment : %s", settings.ENVIRONMENT)
    logger.info("Debug mode  : %s", settings.DEBUG)
    logger.info("Log level   : %s", settings.LOG_LEVEL)

    if settings.ENVIRONMENT == "development":
        logger.info("[startup] Initializing database tables (development mode)")
        try:
            init_db()
            logger.info("[startup] Database tables initialized successfully")
        except Exception as e:
            logger.critical("[startup] Failed to initialize database: %s", e, exc_info=True)
            raise

    logger.info("[startup] ✅ Application started successfully")
    yield

    logger.info("[shutdown] Shutting down %s", settings.APP_NAME)
    try:
        dispose_db()
        logger.info("[shutdown] Database connections disposed")
    except Exception as e:
        logger.error("[shutdown] Error disposing database: %s", e, exc_info=True)

    logger.info("[shutdown] ✅ Application shut down cleanly")


# ── App factory ───────────────────────────────────────────────────────────────
logger.info("[startup] Creating FastAPI application")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Modern Enterprise HR Management System",
    docs_url=settings.API_DOCS_URL if settings.API_DOCS_ENABLED else None,
    openapi_url=settings.OPENAPI_URL if settings.API_DOCS_ENABLED else None,
    lifespan=lifespan,
)

logger.info("[startup] FastAPI app created: title=%s version=%s", settings.APP_NAME, settings.APP_VERSION)


# ── Request logging middleware ────────────────────────────────────────────────
@app.middleware("http")
async def request_logger(request: Request, call_next):
    start = time.perf_counter()
    logger.info(
        "[request] --> %s %s  client=%s",
        request.method, request.url.path, request.client.host if request.client else "unknown"
    )
    try:
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        level = logging.ERROR if response.status_code >= 500 \
                else logging.WARNING if response.status_code >= 400 \
                else logging.INFO
        logger.log(
            level,
            "[request] <-- %s %s  status=%d  duration=%.1fms",
            request.method, request.url.path, response.status_code, duration_ms,
        )
        return response
    except Exception as exc:
        duration_ms = (time.perf_counter() - start) * 1000
        logger.error(
            "[request] !! %s %s  EXCEPTION after %.1fms: %s",
            request.method, request.url.path, duration_ms, exc, exc_info=True,
        )
        raise


# ── CORS ──────────────────────────────────────────────────────────────────────
logger.info("[startup] Registering CORS middleware, allowed origins: %s", settings.ALLOWED_ORIGINS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    logger.debug("[health] Health check endpoint called")
    payload = {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }
    logger.debug("[health] Returning: %s", payload)
    return payload


@app.get("/", tags=["Root"])
async def root():
    logger.debug("[root] Root endpoint called")
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "docs_url": settings.API_DOCS_URL if settings.API_DOCS_ENABLED else "Disabled",
        "health_check": "/health",
    }


# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        "[exception] Unhandled %s on %s %s: %s",
        type(exc).__name__, request.method, request.url.path, exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "type": type(exc).__name__,
        },
    )


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    logger.info("[startup] Launching uvicorn on 0.0.0.0:8000")
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.RELOAD,
        log_level=settings.LOG_LEVEL.lower(),
    )