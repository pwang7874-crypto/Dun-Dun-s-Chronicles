from datetime import datetime, timezone

import pytest

from app.core.config import Settings
from app.core.errors import AppError, AuthenticationError
from app.core.security import SessionTokenService
from app.services.entitlements import daily_bucket, next_beijing_midnight
from app.services.images import validate_image


def test_session_tampering_is_rejected():
    tokens = SessionTokenService("a-secret-that-is-long-enough-for-tests")
    token = tokens.issue("user-1", now=100)
    with pytest.raises(AuthenticationError):
        tokens.verify(token + "x", now=101)


def test_image_magic_bytes_are_enforced():
    with pytest.raises(AppError) as error:
        validate_image(b"not really a png")
    assert error.value.code == "IMAGE_TYPE_UNSUPPORTED"


def test_daily_quota_uses_beijing_midnight():
    now = datetime(2026, 9, 3, 15, 59, tzinfo=timezone.utc)
    assert daily_bucket(now) == "daily:2026-09-03"
    assert next_beijing_midnight(now).isoformat() == "2026-09-04T00:00:00+08:00"


def test_production_rejects_ephemeral_database_and_dev_secrets():
    with pytest.raises(ValueError):
        Settings(app_env="production")

