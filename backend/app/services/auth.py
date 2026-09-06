from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.core.errors import AppError, AuthenticationError
from app.core.security import (
    SessionTokenService,
    generate_sms_code,
    hash_invite_code,
    hash_phone,
    hash_sms_code,
    verify_sms_code,
)
from app.models import InviteCode, SmsChallenge, User, new_id
from app.services.invites import normalize_invite_code
from app.services.sms import SmsProvider


SMS_RESEND_SECONDS = 60
SMS_MAX_REQUESTS_PER_HOUR = 5


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


class AuthService:
    def __init__(
        self,
        session_factory: sessionmaker[Session],
        sms: SmsProvider,
        tokens: SessionTokenService,
        phone_secret: str,
        invite_secret: str,
    ):
        self._sessions = session_factory
        self._sms = sms
        self._tokens = tokens
        self._phone_secret = phone_secret
        self._invite_secret = invite_secret

    def request_code(self, phone: str) -> SmsChallenge:
        code = generate_sms_code()
        now = datetime.now(timezone.utc)
        phone_digest = hash_phone(phone, self._phone_secret)
        db = self._sessions()
        try:
            recent = list(
                db.scalars(
                    select(SmsChallenge)
                    .where(
                        SmsChallenge.phone_hash == phone_digest,
                        SmsChallenge.created_at >= now - timedelta(hours=1),
                    )
                    .order_by(SmsChallenge.created_at.desc())
                )
            )
            if recent and (now - _utc(recent[0].created_at)).total_seconds() < SMS_RESEND_SECONDS:
                raise AppError("SMS_TOO_FREQUENT", "请在 60 秒后重新获取验证码", 429)
            if len(recent) >= SMS_MAX_REQUESTS_PER_HOUR:
                raise AppError("SMS_HOURLY_LIMIT", "验证码请求过于频繁，请稍后再试", 429)

            challenge = SmsChallenge(
                id=new_id(),
                phone_hash=phone_digest,
                phone_last4=phone[-4:],
                expires_at=now + timedelta(minutes=5),
            )
            challenge.code_hash = hash_sms_code(challenge.id, code, self._phone_secret)
            self._sms.send_login_code(phone, code)
            db.add(challenge)
            db.commit()
            db.refresh(challenge)
            return challenge
        finally:
            db.close()

    def verify_code(self, challenge_id: str, code: str) -> tuple[User, str]:
        db = self._sessions()
        try:
            challenge = db.get(SmsChallenge, challenge_id)
            now = datetime.now(timezone.utc)
            if not challenge or challenge.consumed_at:
                raise AuthenticationError("SMS_CHALLENGE_INVALID", "验证码已失效，请重新获取")
            if _utc(challenge.expires_at) <= now or challenge.attempts >= 5:
                raise AuthenticationError("SMS_CHALLENGE_EXPIRED", "验证码已失效，请重新获取")
            correct = verify_sms_code(challenge.id, code, challenge.code_hash, self._phone_secret)
            values = {"consumed_at": now} if correct else {"attempts": SmsChallenge.attempts + 1}
            changed = db.execute(
                update(SmsChallenge)
                .where(
                    SmsChallenge.id == challenge.id,
                    SmsChallenge.consumed_at.is_(None),
                    SmsChallenge.expires_at > now,
                    SmsChallenge.attempts < 5,
                )
                .values(**values)
                .execution_options(synchronize_session=False)
            )
            if changed.rowcount != 1:
                db.rollback()
                current = db.get(SmsChallenge, challenge_id, populate_existing=True)
                if not current or current.consumed_at:
                    raise AuthenticationError("SMS_CHALLENGE_INVALID", "验证码已失效，请重新获取")
                raise AuthenticationError("SMS_CHALLENGE_EXPIRED", "验证码已失效，请重新获取")
            if not correct:
                db.commit()
                raise AuthenticationError("SMS_CODE_INCORRECT", "验证码不正确")
            user = db.scalar(select(User).where(User.phone_hash == challenge.phone_hash))
            if not user:
                try:
                    with db.begin_nested():
                        user = User(phone_hash=challenge.phone_hash, phone_last4=challenge.phone_last4)
                        db.add(user)
                        db.flush()
                except IntegrityError:
                    user = db.scalar(select(User).where(User.phone_hash == challenge.phone_hash))
                    if not user:
                        raise
            db.commit()
            db.refresh(user)
            return user, self._tokens.issue(user.id)
        except AppError:
            raise
        finally:
            db.close()

    def create_dev_session(self, phone: str) -> tuple[User, str]:
        db = self._sessions()
        try:
            phone_digest = hash_phone(phone, self._phone_secret)
            user = db.scalar(select(User).where(User.phone_hash == phone_digest))
            if not user:
                user = User(phone_hash=phone_digest, phone_last4=phone[-4:])
                db.add(user)
                db.commit()
                db.refresh(user)
            return user, self._tokens.issue(user.id)
        finally:
            db.close()

    def login_with_invite(self, code: str) -> tuple[User, str]:
        """内测阶段：邀请码即登录。输入邀请码即创建/回到绑定账号并激活额度。"""
        normalized = normalize_invite_code(code)
        if not 6 <= len(normalized) <= 32:
            raise AppError("INVITE_CODE_INVALID", "邀请码格式不正确，请检查后重试", 422)
        identity = hash_invite_code(normalized, self._invite_secret)
        now = datetime.now(timezone.utc)
        db = self._sessions()
        try:
            invite = db.scalar(select(InviteCode).where(InviteCode.code_hash == identity))
            if not invite:
                raise AppError("INVITE_CODE_INVALID", "邀请码不正确，请检查后重试", 422)
            if invite.redeemed_by_user_id:
                user = db.get(User, invite.redeemed_by_user_id)
                if not user:
                    raise AppError("INVITE_CODE_INVALID", "邀请码对应账号异常", 422)
                return user, self._tokens.issue(user.id)
            # 有效期只限制首次激活；已绑定的邀请码仍是内测账号的登录凭证。
            # 重新登录不会再次赠送额度，也不延长会员或生成次数。
            if invite.expires_at and _utc(invite.expires_at) <= now:
                raise AppError("INVITE_CODE_EXPIRED", "这个邀请码尚未激活且已经过期", 422)

            # 首次使用：创建账号并原子兑换（防止并发重复兑换）。
            user = User(
                phone_hash=identity,
                phone_last4=normalized[-4:],
                invite_credits_remaining=invite.credits,
            )
            db.add(user)
            db.flush()
            redeemed = db.execute(
                update(InviteCode)
                .where(InviteCode.id == invite.id, InviteCode.redeemed_by_user_id.is_(None))
                .values(redeemed_by_user_id=user.id, redeemed_at=now)
                .execution_options(synchronize_session=False)
            )
            if redeemed.rowcount != 1:
                db.rollback()
                fresh = db.scalar(select(InviteCode).where(InviteCode.id == invite.id))
                existing = db.get(User, fresh.redeemed_by_user_id) if fresh and fresh.redeemed_by_user_id else None
                if not existing:
                    raise AppError("INVITE_CODE_USED", "这个邀请码已经被使用过了", 422)
                return existing, self._tokens.issue(existing.id)
            db.commit()
            db.refresh(user)
            return user, self._tokens.issue(user.id)
        except IntegrityError:
            # 两个设备同时首次登录：唯一约束的失败方回到已经绑定的账号，
            # 不抛出 500，也不重发免费次数。必须先回滚失败的事务。
            db.rollback()
            fresh = db.scalar(select(InviteCode).where(InviteCode.code_hash == identity))
            existing = db.get(User, fresh.redeemed_by_user_id) if fresh and fresh.redeemed_by_user_id else None
            if not existing:
                raise
            return existing, self._tokens.issue(existing.id)
        except AppError:
            raise
        finally:
            db.close()
