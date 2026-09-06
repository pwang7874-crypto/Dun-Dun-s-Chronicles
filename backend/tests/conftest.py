from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.security import hash_invite_code
from app.main import create_app
from app.models import InviteCode, new_id


PNG = b"\x89PNG\r\n\x1a\n" + b"ton-ton" + b"IEND\xaeB`\x82"


class FakeAiProvider:
    def __init__(self, fail: bool = False):
        self.fail = fail
        self.calls = 0

    def generate(self, image: bytes, mime_type: str, prompt: str) -> bytes:
        self.calls += 1
        if self.fail:
            raise RuntimeError("provider unavailable")
        return PNG


class FakeSmsProvider:
    def __init__(self):
        self.code = ""

    def send_login_code(self, phone: str, code: str) -> str:
        self.code = code
        return "fake-message-id"


@pytest.fixture
def app_factory(tmp_path: Path):
    def factory(*, ai=None, sms=None):
        settings = Settings(
            _env_file=None,
            DUNDUNJI_ENV="test",
            storage_backend="local",
            database_url=f"sqlite:///{tmp_path / 'test.sqlite3'}",
            local_storage_dir=tmp_path / "storage",
            allow_dev_auth=True,
            ark_api_key="",
            ark_model_id="",
            session_signing_secret="test-session-secret-with-more-than-32-bytes",
            phone_hash_secret="test-phone-secret-with-more-than-32-bytesxx",
            invite_code_secret="test-invite-secret-with-more-than-32-bytes",
        )
        app = create_app(settings, ai_provider=ai or FakeAiProvider(), sms_provider=sms or FakeSmsProvider())
        return app

    return factory


@pytest.fixture
def client(app_factory):
    with TestClient(app_factory()) as value:
        yield value


def auth_headers(client: TestClient) -> dict[str, str]:
    response = client.post("/api/v1/dev/session", json={"phone": "13800000000"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['accessToken']}"}


def seed_invite_code(app, code: str = "TESTINVITE123", credits: int = 5, redeemed: bool = False, expires_at=None) -> str:
    now = datetime.now(timezone.utc)
    with app.state.session_factory() as db:
        db.add(
            InviteCode(
                id=new_id(),
                code_hash=hash_invite_code(code, app.state.settings.invite_code_secret),
                code_hint=code[:4],
                credits=credits,
                redeemed_by_user_id="someone-else" if redeemed else None,
                redeemed_at=now if redeemed else None,
                expires_at=expires_at,
            )
        )
        db.commit()
    return code
