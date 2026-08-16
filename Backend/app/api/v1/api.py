from fastapi import APIRouter

from app.api.v1.endpoints import (
    analytics,
    audit,
    copilot,
    auth,
    export,
    knowledge_graph,
    notifications,
    pipeline,
    products,
    search,
    upload,
    validation,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(upload.router)
api_router.include_router(pipeline.router)
api_router.include_router(products.router)
api_router.include_router(knowledge_graph.router)
api_router.include_router(validation.router)
api_router.include_router(analytics.router)
api_router.include_router(search.router)
api_router.include_router(export.router)
api_router.include_router(audit.router)
api_router.include_router(copilot.router)
api_router.include_router(notifications.router)


