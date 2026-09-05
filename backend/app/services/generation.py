from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.core.errors import AppError
from app.models import AiGenerationJob, User
from app.services.ai_provider import AiImageProvider
from app.services.entitlements import consume_entitlement, release_entitlement, reserve_entitlement
from app.services.images import ValidatedImage, validate_image
from app.services.prompts import get_style
from app.services.storage import ObjectStorage


class AiGenerationService:
    def __init__(
        self,
        session_factory: sessionmaker[Session],
        provider: AiImageProvider,
        storage: ObjectStorage,
    ):
        self._sessions = session_factory
        self._provider = provider
        self._storage = storage

    def create(
        self,
        user_id: str,
        record_id: str,
        style_id: str,
        idempotency_key: str,
        raw_image: bytes,
    ) -> AiGenerationJob:
        if not 1 <= len(record_id) <= 80 or not 10 <= len(idempotency_key) <= 100:
            raise AppError("AI_REQUEST_INVALID", "生成请求信息不完整", 422)
        image = validate_image(raw_image)
        style = get_style(style_id)

        db = self._sessions()
        try:
            existing = db.scalar(
                select(AiGenerationJob).where(
                    AiGenerationJob.user_id == user_id,
                    AiGenerationJob.idempotency_key == idempotency_key,
                )
            )
            if existing:
                return existing
            user = db.get(User, user_id)
            if not user:
                raise AppError("USER_NOT_FOUND", "登录状态已失效，请重新登录", 401)
            now = datetime.now(timezone.utc)
            job = AiGenerationJob(
                user_id=user.id,
                record_id=record_id,
                idempotency_key=idempotency_key,
                style_id=style.id,
                status="queued",
                created_at=now,
                updated_at=now,
            )
            db.add(job)
            db.flush()
            reserve_entitlement(db, user, job, now)
            db.commit()
            db.refresh(job)
        finally:
            db.close()

        return self._process(job.id, image, style.prompt)

    def get(self, user_id: str, job_id: str) -> AiGenerationJob | None:
        db = self._sessions()
        try:
            return db.scalar(
                select(AiGenerationJob).where(
                    AiGenerationJob.id == job_id,
                    AiGenerationJob.user_id == user_id,
                )
            )
        finally:
            db.close()

    def _process(self, job_id: str, image: ValidatedImage, prompt: str) -> AiGenerationJob:
        db = self._sessions()
        input_key: str | None = None
        try:
            job = db.get(AiGenerationJob, job_id)
            if not job:
                raise AppError("AI_JOB_NOT_FOUND", "生成任务不存在", 404)
            input_key = f"private/{job.user_id}/ai/{job.id}/input.{image.extension}"
            self._storage.put(input_key, image.content, image.mime_type)
            job.input_key = input_key
            job.status = "processing"
            job.updated_at = datetime.now(timezone.utc)
            db.commit()

            output = validate_image(self._provider.generate(image.content, image.mime_type, prompt))
            output_key = f"private/{job.user_id}/ai/{job.id}/output.{output.extension}"
            self._storage.put(output_key, output.content, output.mime_type)

            job = db.get(AiGenerationJob, job_id)
            if not job:
                raise AppError("AI_JOB_NOT_FOUND", "生成任务不存在", 404)
            job.output_key = output_key
            job.status = "completed"
            job.error_code = None
            job.error_message = None
            job.updated_at = datetime.now(timezone.utc)
            consume_entitlement(db, job, job.updated_at)
            db.commit()
            db.refresh(job)
            return job
        except Exception as exc:
            db.rollback()
            job = db.get(AiGenerationJob, job_id)
            if job:
                now = datetime.now(timezone.utc)
                job.status = "failed"
                job.error_code = exc.code if isinstance(exc, AppError) else "AI_GENERATION_FAILED"
                job.error_message = exc.message if isinstance(exc, AppError) else "AI 暂时没有生成成功，请稍后重试"
                job.updated_at = now
                release_entitlement(db, job, now)
                db.commit()
            if input_key:
                try:
                    self._storage.delete(input_key)
                except Exception:
                    pass
            if isinstance(exc, AppError):
                raise
            raise AppError("AI_GENERATION_FAILED", "AI 暂时没有生成成功，请稍后重试", 502) from exc
        finally:
            db.close()

