"""
Database connection and session management.
Uses SQLAlchemy with PostgreSQL.
"""

import logging
from typing import Generator
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool

from src.core.config import settings

logger = logging.getLogger(__name__)

logger.info("Initializing database engine")
try:
    engine = create_engine(
        str(settings.DATABASE_URL),
        poolclass=QueuePool,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_recycle=settings.DB_POOL_RECYCLE,
        echo=settings.DEBUG,
        future=True,
    )
    logger.info("Database engine created successfully")
except Exception as e:
    logger.critical(f"Failed to create database engine: {e}", exc_info=True)
    raise

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    logger.debug("Opening new database session")
    db = SessionLocal()
    try:
        yield db
        logger.debug("Database session yielded successfully")
    except Exception as e:
        logger.error(f"Database session error: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        logger.debug("Closing database session")
        db.close()


@event.listens_for(engine, "connect")
def receive_connect(dbapi_conn, connection_record):
    logger.debug("New database connection established, setting timezone to UTC")
    try:
        cursor = dbapi_conn.cursor()
        cursor.execute("SET timezone='UTC';")
        cursor.close()
        logger.debug("Timezone set to UTC successfully")
    except Exception as e:
        logger.error(f"Failed to set timezone on connect: {e}", exc_info=True)
        raise


@event.listens_for(engine, "checkout")
def receive_checkout(dbapi_conn, connection_record, connection_proxy):
    logger.debug("Checking out connection from pool, verifying it is alive")
    cursor = dbapi_conn.cursor()
    try:
        cursor.execute("SELECT 1")
        logger.debug("Connection health check passed")
    except Exception as e:
        logger.warning(f"Connection health check failed, discarding connection: {e}")
        raise
    finally:
        cursor.close()


def init_db() -> None:
    logger.info("Initializing database tables")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized successfully")
    except Exception as e:
        logger.critical(f"Failed to initialize database tables: {e}", exc_info=True)
        raise


def dispose_db() -> None:
    logger.info("Disposing database engine and connections")
    try:
        engine.dispose()
        logger.info("Database engine disposed successfully")
    except Exception as e:
        logger.error(f"Error disposing database engine: {e}", exc_info=True)
        raise