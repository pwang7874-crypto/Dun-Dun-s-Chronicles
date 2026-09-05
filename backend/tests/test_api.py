from fastapi.testclient import TestClient

from tests.conftest import PNG, FakeAiProvider, FakeSmsProvider, auth_headers, seed_invite_code


def test_health_is_honest_about_unconfigured_external_services(client: TestClient):
    response = client.get("/health/ready")
    assert response.status_code == 200
    assert response.json()["components"] == {
        "database": True,
        "ark": False,
        "storage": True,
        "sms": True,
    }


def test_ai_style_catalog_exposes_twelve_server_whitelisted_styles(client: TestClient):
    response = client.get("/api/v1/ai/styles")
    assert response.status_code == 200
    styles = response.json()["styles"]
    assert len(styles) == 12
    assert {item["id"] for item in styles} >= {
        "cream-poster",
        "ticket-zine",
        "watercolor-cafe",
        "ccd-flash",
        "paper-diorama",
    }


def test_unknown_ai_style_is_rejected(client: TestClient):
    response = client.post(
        "/api/v1/ai/generations",
        headers=auth_headers(client),
        data={"idempotency_key": "unknown-style-001", "record_id": "record-1", "style_id": "free-form-prompt"},
        files={"image": ("drink.png", PNG, "image/png")},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "AI_STYLE_NOT_FOUND"


def test_sms_code_creates_a_real_session(app_factory):
    sms = FakeSmsProvider()
    with TestClient(app_factory(sms=sms)) as client:
        requested = client.post("/api/v1/auth/sms/request", json={"phone": "+86 13800000001"})
        assert requested.status_code == 200
        verified = client.post(
            "/api/v1/auth/sms/verify",
            json={"challengeId": requested.json()["challengeId"], "code": sms.code},
        )
        assert verified.status_code == 200
        assert verified.json()["phoneMasked"].endswith("0001")


def test_sms_resend_is_rate_limited(client: TestClient):
    first = client.post("/api/v1/auth/sms/request", json={"phone": "13800000002"})
    second = client.post("/api/v1/auth/sms/request", json={"phone": "13800000002"})
    assert first.status_code == 200
    assert second.status_code == 429
    assert second.json()["error"]["code"] == "SMS_TOO_FREQUENT"


def test_user_without_invite_code_cannot_generate(client: TestClient):
    headers = auth_headers(client)
    response = client.post(
        "/api/v1/ai/generations",
        headers=headers,
        data={"idempotency_key": "no-invite-001", "record_id": "record-1", "style_id": "cream-poster"},
        files={"image": ("drink.png", PNG, "image/png")},
    )
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "AI_QUOTA_EXHAUSTED"


def test_failed_generation_releases_the_invite_credit(app_factory):
    provider = FakeAiProvider(fail=True)
    app = app_factory(ai=provider)
    seed_invite_code(app, credits=1)
    with TestClient(app) as client:
        headers = auth_headers(client)
        assert client.post("/api/v1/invite/redeem", json={"code": "TESTINVITE123"}, headers=headers).status_code == 200
        failed = client.post(
            "/api/v1/ai/generations",
            headers=headers,
            data={"idempotency_key": "failed-request-001", "record_id": "record-1", "style_id": "cream-poster"},
            files={"image": ("drink.png", PNG, "image/png")},
        )
        assert failed.status_code == 502
        entitlements = client.get("/api/v1/me/entitlements", headers=headers)
        assert entitlements.json()["inviteCreditsRemaining"] == 1
        provider.fail = False
        retried = client.post(
            "/api/v1/ai/generations",
            headers=headers,
            data={"idempotency_key": "retry-request-002", "record_id": "record-1", "style_id": "cream-poster"},
            files={"image": ("drink.png", PNG, "image/png")},
        )
        assert retried.status_code == 201
        assert retried.json()["status"] == "completed"


def test_duplicate_idempotency_key_does_not_generate_twice(app_factory):
    provider = FakeAiProvider()
    app = app_factory(ai=provider)
    seed_invite_code(app, credits=3)
    with TestClient(app) as client:
        headers = auth_headers(client)
        assert client.post("/api/v1/invite/redeem", json={"code": "TESTINVITE123"}, headers=headers).status_code == 200
        request = {
            "headers": headers,
            "data": {"idempotency_key": "same-request-key", "record_id": "record-1", "style_id": "cream-poster"},
            "files": {"image": ("drink.png", PNG, "image/png")},
        }
        assert client.post("/api/v1/ai/generations", **request).status_code == 201
        assert client.post("/api/v1/ai/generations", **request).status_code == 201
        assert provider.calls == 1
