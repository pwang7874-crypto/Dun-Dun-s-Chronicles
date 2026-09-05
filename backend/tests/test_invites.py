from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from tests.conftest import PNG, auth_headers, seed_invite_code


def _redeem(client: TestClient, headers: dict[str, str], code: str):
    return client.post("/api/v1/invite/redeem", json={"code": code}, headers=headers)


def _generate(client: TestClient, headers: dict[str, str], key: str, style: str = "cream-poster"):
    return client.post(
        "/api/v1/ai/generations",
        headers=headers,
        data={"idempotency_key": key, "record_id": "record-1", "style_id": style},
        files={"image": ("drink.png", PNG, "image/png")},
    )


def test_redeem_invite_grants_credits_and_normalizes_input(app_factory):
    app = app_factory()
    seed_invite_code(app, code="TESTINVITE123", credits=7)
    with TestClient(app) as client:
        headers = auth_headers(client)
        result = _redeem(client, headers, "test-invite-123")
        assert result.status_code == 200
        assert result.json() == {"creditsGranted": 7, "inviteCreditsRemaining": 7}
        entitlements = client.get("/api/v1/me/entitlements", headers=headers).json()
        assert entitlements["inviteCreditsRemaining"] == 7
        assert entitlements["entitlementKind"] == "invite"


def test_generation_consumes_invite_credit(app_factory):
    app = app_factory()
    seed_invite_code(app, credits=2)
    with TestClient(app) as client:
        headers = auth_headers(client)
        assert _redeem(client, headers, "TESTINVITE123").status_code == 200
        first = _generate(client, headers, "invite-gen-001")
        assert first.status_code == 201
        assert client.get("/api/v1/me/entitlements", headers=headers).json()["inviteCreditsRemaining"] == 1
        second = _generate(client, headers, "invite-gen-002", style="rain-notebook")
        assert second.status_code == 201
        assert client.get("/api/v1/me/entitlements", headers=headers).json()["inviteCreditsRemaining"] == 0


def test_generation_is_rejected_after_invite_credits_run_out(app_factory):
    app = app_factory()
    seed_invite_code(app, credits=1)
    with TestClient(app) as client:
        headers = auth_headers(client)
        assert _redeem(client, headers, "TESTINVITE123").status_code == 200
        assert _generate(client, headers, "invite-gen-001").status_code == 201
        exhausted = _generate(client, headers, "invite-gen-002")
        assert exhausted.status_code == 429
        assert exhausted.json()["error"]["code"] == "AI_QUOTA_EXHAUSTED"


def test_same_invite_cannot_be_redeemed_twice(app_factory):
    app = app_factory()
    seed_invite_code(app, credits=3)
    with TestClient(app) as client:
        headers = auth_headers(client)
        assert _redeem(client, headers, "TESTINVITE123").status_code == 200
        again = _redeem(client, headers, "TESTINVITE123")
        assert again.status_code == 422
        assert again.json()["error"]["code"] == "INVITE_CODE_USED"


def test_unknown_invite_is_rejected_without_credits(app_factory):
    app = app_factory()
    seed_invite_code(app, code="TESTINVITE123")
    with TestClient(app) as client:
        headers = auth_headers(client)
        result = _redeem(client, headers, "WRONGCODE999")
        assert result.status_code == 422
        assert result.json()["error"]["code"] == "INVITE_CODE_INVALID"
        assert client.get("/api/v1/me/entitlements", headers=headers).json()["inviteCreditsRemaining"] == 0


def test_expired_invite_is_rejected(app_factory):
    app = app_factory()
    seed_invite_code(app, expires_at=datetime.now(timezone.utc) - timedelta(days=1))
    with TestClient(app) as client:
        headers = auth_headers(client)
        result = _redeem(client, headers, "TESTINVITE123")
        assert result.status_code == 422
        assert result.json()["error"]["code"] == "INVITE_CODE_EXPIRED"


def test_redeem_requires_login(client: TestClient):
    result = client.post("/api/v1/invite/redeem", json={"code": "TESTINVITE123"})
    assert result.status_code == 401


def test_invite_login_grants_session_and_activates_credits(app_factory):
    app = app_factory()
    seed_invite_code(app, code="LOGININVITE1", credits=6)
    with TestClient(app) as client:
        login = client.post("/api/v1/auth/invite", json={"code": "login-invite-1"})
        assert login.status_code == 200
        token = login.json()["accessToken"]
        assert token
        headers = {"Authorization": f"Bearer {token}"}
        entitlements = client.get("/api/v1/me/entitlements", headers=headers).json()
        assert entitlements["inviteCreditsRemaining"] == 6


def test_invite_login_returns_same_account_on_second_device(app_factory):
    app = app_factory()
    seed_invite_code(app, code="LOGININVITE2", credits=3)
    with TestClient(app) as client:
        first = client.post("/api/v1/auth/invite", json={"code": "LOGININVITE2"})
        first_token = first.json()["accessToken"]
        # 消耗一次额度
        headers = {"Authorization": f"Bearer {first_token}"}
        _generate(client, headers, "invite-login-gen-001")
        # 换设备重新登录同一个邀请码
        second = client.post("/api/v1/auth/invite", json={"code": "LOGININVITE2"})
        assert second.status_code == 200
        second_headers = {"Authorization": f"Bearer {second.json()['accessToken']}"}
        remaining = client.get("/api/v1/me/entitlements", headers=second_headers).json()
        assert remaining["inviteCreditsRemaining"] == 2


def test_invite_login_rejects_unknown_code(app_factory):
    app = app_factory()
    with TestClient(app) as client:
        result = client.post("/api/v1/auth/invite", json={"code": "NOPE9999"})
        assert result.status_code == 422
        assert result.json()["error"]["code"] == "INVITE_CODE_INVALID"
