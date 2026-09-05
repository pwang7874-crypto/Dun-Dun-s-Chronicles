from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass

from app.core.errors import AuthenticationError


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def hash_phone(phone: str, secret: str) -> str:
    return hmac.new(secret.encode(), phone.encode(), hashlib.sha256).hexdigest()


def hash_sms_code(challenge_id: str, code: str, secret: str) -> str:
    message = f"{challenge_id}:{code}".encode()
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def verify_sms_code(challenge_id: str, code: str, expected: str, secret: str) -> bool:
    actual = hash_sms_code(challenge_id, code, secret)
    return hmac.compare_digest(actual, expected)


def generate_sms_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


# 排除容易混淆的 0/O/1/I/L，降低用户输入错误。
INVITE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"


def generate_invite_code(length: int = 10) -> str:
    return "".join(secrets.choice(INVITE_ALPHABET) for _ in range(length))


def hash_invite_code(code: str, secret: str) -> str:
    return hmac.new(secret.encode(), code.encode(), hashlib.sha256).hexdigest()


@dataclass(frozen=True)
class SessionClaims:
    user_id: str
    expires_at: int


class SessionTokenService:
    def __init__(self, secret: str, lifetime_seconds: int = 30 * 24 * 60 * 60):
        self._secret = secret.encode()
        self._lifetime_seconds = lifetime_seconds

    def issue(self, user_id: str, now: int | None = None) -> str:
        issued_at = int(now if now is not None else time.time())
        payload = {"sub": user_id, "iat": issued_at, "exp": issued_at + self._lifetime_seconds}
        encoded = _b64encode(json.dumps(payload, separators=(",", ":")).encode())
        signature = _b64encode(hmac.new(self._secret, encoded.encode(), hashlib.sha256).digest())
        return f"{encoded}.{signature}"

    def verify(self, token: str, now: int | None = None) -> SessionClaims:
        try:
            encoded, signature = token.split(".", 1)
            expected = _b64encode(hmac.new(self._secret, encoded.encode(), hashlib.sha256).digest())
            if not hmac.compare_digest(signature, expected):
                raise ValueError("signature")
            payload = json.loads(_b64decode(encoded))
            expires_at = int(payload["exp"])
            user_id = str(payload["sub"])
            if expires_at <= int(now if now is not None else time.time()):
                raise ValueError("expired")
            return SessionClaims(user_id=user_id, expires_at=expires_at)
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
            raise AuthenticationError() from exc

