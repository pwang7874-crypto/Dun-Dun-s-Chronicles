from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import generate_invite_code, hash_invite_code
from app.models import InviteCode, User, new_id


def normalize_invite_code(code: str) -> str:
    return "".join(ch for ch in code.upper() if ch.isalnum())


def _aware_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def redeem_invite_code(
    db: Session,
    user: User,
    code: str,
    secret: str,
    now: datetime,
) -> tuple[int, int]:
    normalized = normalize_invite_code(code)
    if not 6 <= len(normalized) <= 32:
        raise AppError("INVITE_CODE_INVALID", "邀请码格式不正确，请检查后重试", 422)

    code_hash = hash_invite_code(normalized, secret)
    invite = db.scalar(select(InviteCode).where(InviteCode.code_hash == code_hash))
    if not invite:
        raise AppError("INVITE_CODE_INVALID", "邀请码不正确，请检查后重试", 422)
    if invite.redeemed_by_user_id:
        raise AppError("INVITE_CODE_USED", "这个邀请码已经被使用过了", 422)
    if invite.expires_at and _aware_utc(invite.expires_at) <= now.astimezone(timezone.utc):
        raise AppError("INVITE_CODE_EXPIRED", "这个邀请码已经过期", 422)

    # 原子标记兑换：只有尚未兑换的行能被更新，防止同一邀请码被并发兑换两次。
    redeemed = db.execute(
        update(InviteCode)
        .where(InviteCode.id == invite.id, InviteCode.redeemed_by_user_id.is_(None))
        .values(redeemed_by_user_id=user.id, redeemed_at=now)
        .execution_options(synchronize_session=False)
    )
    if redeemed.rowcount != 1:
        db.rollback()
        raise AppError("INVITE_CODE_USED", "这个邀请码刚刚被兑换了，请刷新后重试", 409)

    db.execute(
        update(User)
        .where(User.id == user.id)
        .values(invite_credits_remaining=User.invite_credits_remaining + invite.credits)
        .execution_options(synchronize_session=False)
    )
    db.commit()

    remaining = db.scalar(select(User.invite_credits_remaining).where(User.id == user.id)) or 0
    return invite.credits, remaining


def create_invite_codes(
    db: Session,
    secret: str,
    count: int,
    credits: int,
    validity_days: int,
    now: datetime | None = None,
) -> list[str]:
    """预生成一批邀请码，返回明文；明文只在此处出现一次，库里只存哈希。"""
    current = now or datetime.now(timezone.utc)
    expires_at = current + timedelta(days=validity_days)
    plain_codes: list[str] = []
    for _ in range(count):
        code = generate_invite_code()
        db.add(
            InviteCode(
                id=new_id(),
                code_hash=hash_invite_code(code, secret),
                code_hint=code[:4],
                credits=credits,
                expires_at=expires_at,
                created_at=current,
            )
        )
        plain_codes.append(code)
    db.commit()
    return plain_codes
