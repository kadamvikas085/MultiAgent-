"""
WebSocket Manager
-----------------
Maintains local WebSocket connections in the FastAPI process.

Celery workers cannot access this in-memory registry directly, so
broadcast() publishes job updates to Redis Pub/Sub. FastAPI runs a
Redis subscriber and forwards received messages to its local sockets.
"""

import asyncio
import json
import logging
from collections import defaultdict

from fastapi import WebSocket
from redis.asyncio import Redis

from app.core.config import settings

logger = logging.getLogger(__name__)

REDIS_CHANNEL_PREFIX = "intellispec:ws:"


class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._redis: Redis | None = None
        self._subscriber_task: asyncio.Task | None = None

    async def connect(self, job_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[job_id].add(websocket)

    def disconnect(self, job_id: str, websocket: WebSocket) -> None:
        self._connections[job_id].discard(websocket)

        if not self._connections[job_id]:
            self._connections.pop(job_id, None)

    async def broadcast(self, job_id: str, payload: dict) -> None:
        """
        Publish an update through Redis.

        A fresh Redis client is used for each Celery broadcast because
        Celery runs async tasks with asyncio.run(), which creates a
        separate event loop for each task.
        """
        redis = Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
        )

        try:
            channel = f"{REDIS_CHANNEL_PREFIX}{job_id}"

            await redis.publish(
                channel,
                json.dumps(payload),
            )
        finally:
            await redis.aclose()

    async def start_subscriber(self) -> None:
        """
        Subscribe to Redis job-update channels and forward received
        messages to local WebSocket connections.
        """
        if self._subscriber_task is not None:
            return

        self._subscriber_task = asyncio.create_task(
            self._subscriber_loop()
        )

    async def stop_subscriber(self) -> None:
        if self._subscriber_task is not None:
            self._subscriber_task.cancel()

            try:
                await self._subscriber_task
            except asyncio.CancelledError:
                pass

            self._subscriber_task = None

        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None

    def _get_redis(self) -> Redis:
        if self._redis is None:
            self._redis = Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
            )

        return self._redis

    async def _subscriber_loop(self) -> None:
        redis = self._get_redis()
        pubsub = redis.pubsub()

        try:
            await pubsub.psubscribe(
                f"{REDIS_CHANNEL_PREFIX}*"
            )

            logger.info("WebSocket Redis subscriber started")

            async for message in pubsub.listen():
                if message["type"] != "pmessage":
                    continue

                channel = message["channel"]
                raw_payload = message["data"]

                job_id = channel.removeprefix(
                    REDIS_CHANNEL_PREFIX
                )

                try:
                    payload = json.loads(raw_payload)
                except json.JSONDecodeError:
                    logger.warning(
                        "Invalid WebSocket payload from Redis: %s",
                        raw_payload,
                    )
                    continue

                await self._send_local(job_id, payload)

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "WebSocket Redis subscriber stopped unexpectedly"
            )

        finally:
            await pubsub.aclose()

    async def _send_local(
        self,
        job_id: str,
        payload: dict,
    ) -> None:
        dead: list[WebSocket] = []

        for websocket in self._connections.get(job_id, set()):
            try:
                await websocket.send_text(
                    json.dumps(payload)
                )
            except Exception:
                dead.append(websocket)

        for websocket in dead:
            self.disconnect(job_id, websocket)


ws_manager = ConnectionManager()