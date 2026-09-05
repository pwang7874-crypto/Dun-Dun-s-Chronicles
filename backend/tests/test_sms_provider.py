import json
import logging
import traceback
from unittest.mock import Mock
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient
from urllib3 import HTTPResponse

from app.core.config import Settings
from app.core.errors import AppError, ConfigurationError
from app.main import create_app
from app.services.sms import UnconfiguredSmsProvider, VolcSmsProvider, create_sms_provider


SMS_CONFIG = {
    "volc_sms_access_key": "test-sms-access-key",
    "volc_sms_secret_key": "test-sms-secret-key",
    "volc_sms_account": "test-message-group",
    "volc_sms_sign": "吨吨记",
    "volc_sms_template_id": "ST_test_template",
}
PHONE = "+8613800000001"
CODE = "123456"


def settings(**overrides):
    return Settings(_env_file=None, **(SMS_CONFIG | overrides))


def response(body, status=200):
    return HTTPResponse(
        body=json.dumps(body).encode(),
        status=status,
        headers={"Content-Type": "application/json"},
    )


def transport(provider, monkeypatch, *, body=None, status=200, error=None):
    mocked = Mock(
        return_value=response(body or {"ResponseMetadata": {}, "Result": {"MessageID": ["test-message-id"]}}, status),
        side_effect=error,
    )
    monkeypatch.setattr(provider._api.api_client.rest_client.pool_manager, "request", mocked)
    return mocked


def test_sms_uses_official_signed_https_request_and_template_variable(monkeypatch):
    provider = VolcSmsProvider(settings(volc_sms_code_param="login_code"))
    send = transport(provider, monkeypatch)
    assert provider.send_login_code(PHONE, CODE) == "test-message-id"
    send.assert_called_once()
    call = send.call_args
    assert call.args[0] == "POST"
    url = urlsplit(call.args[1])
    assert url.scheme == "https"
    assert url.netloc == "sms.volcengineapi.com"
    assert parse_qs(url.query) == {"Action": ["SendSms"], "Version": ["2020-01-01"]}
    body = json.loads(call.kwargs["body"])
    assert body == {
        "SmsAccount": "test-message-group",
        "Sign": "吨吨记",
        "TemplateID": "ST_test_template",
        "PhoneNumbers": PHONE,
        "TemplateParam": json.dumps({"login_code": CODE}),
    }
    assert "Authorization" in call.kwargs["headers"]
    assert call.kwargs["headers"]["X-Sdk-Request"] == "attempt=1; max=1"
    config = provider._api.api_client.configuration
    assert config.auto_retry is False
    assert config.num_max_retries == 0
    assert config.verify_ssl is True
    assert config.debug is False
    assert config.connect_timeout == 5
    assert config.read_timeout == 10
    assert provider._api.api_client.rest_client.pool_manager.connection_pool_kw["retries"].total is False


@pytest.mark.parametrize("status", [200, 400, 429, 500, 503])
def test_sms_provider_errors_are_redacted_and_never_retried(monkeypatch, caplog, status):
    provider = VolcSmsProvider(settings())
    sensitive = f"{PHONE} {CODE} {SMS_CONFIG['volc_sms_access_key']} {SMS_CONFIG['volc_sms_secret_key']}"
    send = transport(
        provider,
        monkeypatch,
        body={"ResponseMetadata": {"Error": {"Code": "Rejected", "Message": sensitive}}},
        status=status,
    )
    with caplog.at_level(logging.DEBUG), pytest.raises(AppError) as error:
        provider.send_login_code(PHONE, CODE)
    assert error.value.code == "SMS_SEND_FAILED"
    assert error.value.status_code == 502
    send.assert_called_once()
    output = "".join(traceback.format_exception(error.value)) + caplog.text
    for value in (PHONE, CODE, SMS_CONFIG["volc_sms_access_key"], SMS_CONFIG["volc_sms_secret_key"]):
        assert value not in output


def test_timeout_does_not_resend_or_expose_upstream_exception(monkeypatch):
    provider = VolcSmsProvider(settings())
    send = transport(provider, monkeypatch, error=TimeoutError(f"{PHONE} {CODE}"))
    with pytest.raises(AppError) as error:
        provider.send_login_code(PHONE, CODE)
    send.assert_called_once()
    output = "".join(traceback.format_exception(error.value))
    assert PHONE not in output
    assert CODE not in output


@pytest.mark.parametrize("result", [None, {}, {"MessageID": []}, {"MessageID": "not-a-list"}, {"MessageID": [""]}, {"MessageID": [None]}, {"MessageID": ["one", "two"]}])
def test_missing_or_malformed_confirmation_is_not_success(monkeypatch, result):
    provider = VolcSmsProvider(settings())
    send = transport(provider, monkeypatch, body={"ResponseMetadata": {}, "Result": result})
    with pytest.raises(AppError) as error:
        provider.send_login_code(PHONE, CODE)
    assert error.value.code == "SMS_SEND_FAILED"
    send.assert_called_once()


@pytest.mark.parametrize("phone,code", [(PHONE + ",13900000000", CODE), ("+12025550123", CODE), (PHONE, "1234"), (PHONE, "１２３４５６")])
def test_invalid_or_multiple_recipients_are_rejected_without_sending(monkeypatch, phone, code):
    provider = VolcSmsProvider(settings())
    send = transport(provider, monkeypatch)
    with pytest.raises(AppError) as error:
        provider.send_login_code(phone, code)
    assert error.value.status_code == 422
    send.assert_not_called()


@pytest.mark.parametrize("missing", list(SMS_CONFIG))
def test_missing_credentials_group_signature_or_template_stays_unconfigured(missing):
    config = settings(**{missing: " "})
    assert config.sms_ready is False
    provider = create_sms_provider(config)
    assert isinstance(provider, UnconfiguredSmsProvider)
    with pytest.raises(ConfigurationError) as error:
        provider.send_login_code(PHONE, CODE)
    assert error.value.status_code == 503
    assert error.value.code == "SMS_NOT_CONFIGURED"


@pytest.mark.parametrize("missing", list(SMS_CONFIG))
def test_sms_factory_stays_unconfigured_without_credentials(missing):
    complete = {
        "app_env": "production",
        "database_url": "postgresql://localhost/dundunji",
        "session_signing_secret": "test-session-signing-secret-longer-than-32",
        "phone_hash_secret": "test-phone-hashing-secret-longer-than-32",
        "invite_code_secret": "test-invite-secret-longer-than-32-bytes",
        "ark_api_key": "test-ark-key",
        "ark_model_id": "test-model",
        "storage_backend": "tos",
        "tos_access_key": "test-tos-key",
        "tos_secret_key": "test-tos-secret",
        "tos_endpoint": "https://tos-cn-beijing.volces.com",
        "tos_region": "cn-beijing",
        "tos_bucket": "test-private-bucket",
    }
    assert settings(**complete).sms_ready is True
    partial = settings(**(complete | {missing: ""}))
    assert partial.sms_ready is False
    provider = create_sms_provider(partial)
    assert isinstance(provider, UnconfiguredSmsProvider)


def test_configuration_errors_do_not_print_sms_secrets():
    with pytest.raises(ValueError) as error:
        settings(volc_sms_timeout_seconds=0)
    assert SMS_CONFIG["volc_sms_access_key"] not in str(error.value)
    assert SMS_CONFIG["volc_sms_secret_key"] not in str(error.value)


def test_app_selects_configured_provider_and_preserves_dependency_injection(tmp_path):
    config = settings(database_url=f"sqlite:///{tmp_path / 'test.sqlite3'}", local_storage_dir=tmp_path / "storage")
    app = create_app(config)
    assert isinstance(app.state.auth_service._sms, VolcSmsProvider)
    assert app.state.sms_ready is True
    injected = Mock()
    assert create_app(config, sms_provider=injected).state.auth_service._sms is injected


def test_unconfigured_api_returns_503_without_a_fake_code(tmp_path):
    config = settings(
        volc_sms_account="",
        database_url=f"sqlite:///{tmp_path / 'test.sqlite3'}",
        local_storage_dir=tmp_path / "storage",
    )
    app = create_app(config)
    assert app.state.sms_ready is False
    with TestClient(app) as client:
        result = client.post("/api/v1/auth/sms/request", json={"phone": PHONE})
    assert result.status_code == 503
    assert result.json()["error"]["code"] == "SMS_NOT_CONFIGURED"
    assert PHONE not in result.text
    assert "challengeId" not in result.json()
