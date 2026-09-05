from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    phone_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    phone_last4: Mapped[str] = mapped_column(String(4), nullable=False)
    membership_tier: Mapped[str] = mapped_column(String(20), default="free", nullable=False)
    membership_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    invite_credits_remaining: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class SmsChallenge(Base):
    __tablename__ = "sms_challenges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    phone_hash: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    phone_last4: Mapped[str] = mapped_column(String(4), nullable=False)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class AiGenerationJob(Base):
    __tablename__ = "ai_generation_jobs"
    __table_args__ = (UniqueConstraint("user_id", "idempotency_key", name="uq_ai_job_idempotency"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    record_id: Mapped[str] = mapped_column(String(80), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(100), nullable=False)
    style_id: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="queued", nullable=False)
    input_key: Mapped[str | None] = mapped_column(String(300))
    output_key: Mapped[str | None] = mapped_column(String(300))
    error_code: Mapped[str | None] = mapped_column(String(80))
    error_message: Mapped[str | None] = mapped_column(Text)
    entitlement_bucket: Mapped[str | None] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    user: Mapped[User] = relationship()


class AiEntitlementUsage(Base):
    __tablename__ = "ai_entitlement_usages"
    __table_args__ = (UniqueConstraint("user_id", "bucket", name="uq_ai_usage_bucket"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    job_id: Mapped[str] = mapped_column(ForeignKey("ai_generation_jobs.id"), unique=True, nullable=False)
    bucket: Mapped[str] = mapped_column(String(40), nullable=False)
    state: Mapped[str] = mapped_column(String(20), default="reserved", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class InviteCode(Base):
    __tablename__ = "invite_codes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    code_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    code_hint: Mapped[str] = mapped_column(String(8), nullable=False)
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    redeemed_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    redeemed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

