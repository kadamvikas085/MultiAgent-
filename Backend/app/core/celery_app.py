from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "unihack_ai",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=60 * 30,  # 30 min hard limit per document
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    # Windows development is most reliable with the solo pool. Production
    # deployments can override the pool in their process manager.
    worker_pool="solo",
)


