from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import QuotaError
from app.models import AiEntitlementUsage, AiGenerationJob, User


BEIJING = ZoneInfo("Asia/Shanghai")


def _aware_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def membership_active(user: User, now: datetime) -> bool:
    expires = _aware_utc(user.membership_expires_at)
    return user.membership_tier == "member" and expires is not None and expires > now.astimezone(timezone.utc)


def daily_bucket(now: datetime) -> str:
    return f"daily:{now.astimezone(BEIJING).date().isoformat()}"


def next_beijing_midnight(now: datetime) -> datetime:
    local = now.astimezone(BEIJING)
    tomorrow = local.date() + timedelta(days=1)
    return datetime.combine(tomorrow, datetime.min.time(), tzinfo=BEIJING)


@dataclass(frozen=True)
class EntitlementSnapshot:
    membership_tier: str
    membership_expires_at: datetime | None
    ai_remaining: int
    kind: str
    resets_at: datetime | None
    invite_credits_remaining: int


def entitlement_snapshot(db: Session, user: User, now: datetime) -> EntitlementSnapshot:
    member = membership_active(user, now)
    if user.invite_credits_remaining > 0:
        kind = "invite"
        remaining = user.invite_credits_remaining
    elif member:
        bucket = daily_bucket(now)
        usage = db.scalar(
            select(AiEntitlementUsage).where(
                AiEntitlementUsage.user_id == user.id,
                AiEntitlementUsage.bucket == bucket,
                AiEntitlementUsage.state.in_(("reserved", "consumed")),
            )
        )
        kind = "none" if usage else "daily"
        remaining = 0 if usage else 1
    else:
        kind = "none"
        remaining = 0
    return EntitlementSnapshot(
        membership_tier="member" if member else "free",
        membership_expires_at=_aware_utc(user.membership_expires_at),
        ai_remaining=remaining,
        kind=kind,
        resets_at=next_beijing_midnight(now) if member else None,
        invite_credits_remaining=user.invite_credits_remaining,
    )


def reserve_entitlement(db: Session, user: User, job: AiGenerationJob, now: datetime) -> str:
    # 内测阶段：邀请码额度是主要生成来源。先原子扣减一次邀请码额度，
    # 成功生成即结算，失败则 release_entitlement 归还。
    if user.invite_credits_remaining > 0:
        deducted = db.execute(
            update(User)
            .where(User.id == user.id, User.invite_credits_remaining > 0)
            .values(invite_credits_remaining=User.invite_credits_remaining - 1)
            .execution_options(synchronize_session=False)
        )
        if deducted.rowcount != 1:
            db.rollback()
            raise QuotaError("邀请码次数不足，请先兑换邀请码")
        job.entitlement_bucket = "invite"
        try:
            db.flush()
        except IntegrityError as exc:
            db.rollback()
            raise QuotaError("这次请求与另一台设备重复，请稍后查看生成记录") from exc
        return "invite"

    # 会员每天一次（北京时间 00:00 恢复）。会员支付尚未接入时该分支不生效。
    member = membership_active(user, now)
    if member:
        bucket = daily_bucket(now)
        existing = db.scalar(
            select(AiEntitlementUsage).where(
                AiEntitlementUsage.user_id == user.id,
                AiEntitlementUsage.bucket == bucket,
            )
        )
        if existing and existing.state in ("reserved", "consumed"):
            raise QuotaError("今天的 AI 灵感已经用过了，明天 00:00 再来")
        if existing:
            existing.job_id = job.id
            existing.state = "reserved"
            existing.updated_at = now
        else:
            db.add(AiEntitlementUsage(user_id=user.id, job_id=job.id, bucket=bucket, state="reserved"))
        job.entitlement_bucket = bucket
        try:
            db.flush()
        except IntegrityError as exc:
            db.rollback()
            raise QuotaError("这次请求与另一台设备重复，请稍后查看生成记录") from exc
        return bucket

    raise QuotaError("需要邀请码才能生成 AI 作品，请先兑换邀请码")


def consume_entitlement(db: Session, job: AiGenerationJob, now: datetime) -> None:
    if job.entitlement_bucket == "invite":
        # 邀请码额度已在 reserve 时原子扣减，成功即结算，无需额外动作。
        return
    usage = db.scalar(select(AiEntitlementUsage).where(AiEntitlementUsage.job_id == job.id))
    if usage:
        usage.state = "consumed"
        usage.updated_at = now


def release_entitlement(db: Session, job: AiGenerationJob, now: datetime) -> None:
    if job.entitlement_bucket == "invite":
        db.execute(
            update(User)
            .where(User.id == job.user_id)
            .values(invite_credits_remaining=User.invite_credits_remaining + 1)
            .execution_options(synchronize_session=False)
        )
        return
    usage = db.scalar(select(AiEntitlementUsage).where(AiEntitlementUsage.job_id == job.id))
    if usage:
        usage.state = "released"
        usage.updated_at = now
