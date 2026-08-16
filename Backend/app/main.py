"""
UniHack AI — FastAPI application entrypoint.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.core.config import settings
from app.websocket.manager import ws_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup/shutdown lifecycle.

    Starts the Redis Pub/Sub subscriber when FastAPI starts so
    Celery WebSocket updates can be forwarded to connected browsers.
    """
    await ws_manager.start_subscriber()

    try:
        yield
    finally:
        await ws_manager.stop_subscriber()


def create_app() -> FastAPI:
    # /docs and /redoc are useful during development/prototype testing.
    # They are disabled automatically in production.
    is_dev = settings.APP_ENV != "production"

    app = FastAPI(
        title=settings.APP_NAME,
        description="AI Product Intelligence Platform for Industrial Commerce",
        version="1.0.0",
        docs_url="/docs" if is_dev else None,
        redoc_url="/redoc" if is_dev else None,
        openapi_url="/openapi.json" if is_dev else None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(
        api_router,
        prefix=settings.API_V1_PREFIX,
    )

    @app.get("/health", tags=["System"])
    async def health_check():
        return {
            "status": "ok",
            "app": settings.APP_NAME,
            "env": settings.APP_ENV,
        }

    return app


app = create_app()