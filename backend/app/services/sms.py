from __future__ import annotations

import json
import logging
import re
from typing import Protocol

from volcenginesdkcore import ApiClient, Configuration
from volcenginesdkcore.observability.debugger import LogLevel
from volcenginesdkcore.universal import UniversalApi, UniversalInfo

from app.core.config import Settings
from app.core.errors import AppError, ConfigurationError


class SmsProvider(Protocol):
    def send_login_code(self, phone: str, code: str) -> str: ...


class UnconfiguredSmsProvider:
    def send_login_code(self, phone: str, code: str) -> str:
        raise ConfigurationError(
            "SMS_NOT_CONFIGURED",
            "短信服务尚未配置；请先完成消息组、短信签名和模板审核",
        )


class VolcSmsProvider:
    def __init__(self, settings: Settings):
        if not settings.sms_ready:
            raise ConfigurationError("SMS_NOT_CONFIGURED", "短信服务尚未配置")
        config = Configuration()
        config.ak = settings.volc_sms_access_key.strip()
        config.sk = settings.volc_sms_secret_key.strip()
        config.credential_provider = None
        config.session_token = ""
        config.region = settings.volc_sms_region.strip()
        config.host = "sms.volcengineapi.com"
        config.scheme = "https"
        config.verify_ssl = True
        config.auto_retry = False
        config.num_max_retries = 0
        config.connect_timeout = min(5, settings.volc_sms_timeout_seconds)
        config.read_timeout = settings.volc_sms_timeout_seconds
        config.debug = False
        config.log_level = LogLevel.LOG_DEBUG_OFF.mask
        logging.getLogger("volcenginesdkcore.rest").setLevel(logging.WARNING)
        self._api = UniversalApi(ApiClient(config))
        self._settings = settings

    def send_login_code(self, phone: str, code: str) -> str:
        if not re.fullmatch(r"(?:\+86)?1[3-9][0-9]{9}", phone) or not re.fullmatch(r"[0-9]{6}", code):
            raise AppError("SMS_REQUEST_INVALID", "短信请求信息不正确", 422)
        body = {
            "SmsAccount": self._settings.volc_sms_account.strip(),
            "Sign": self._settings.volc_sms_sign.strip(),
            "TemplateID": self._settings.volc_sms_template_id.strip(),
            "TemplateParam": json.dumps({self._settings.volc_sms_code_param: code}),
            "PhoneNumbers": phone,
        }
        info = UniversalInfo(
            method="POST",
            service="volcSMS",
            version="2020-01-01",
            action="SendSms",
            content_type="application/json",
        )
        try:
            result = self._api.do_call(info, body)
            message_ids = result.get("MessageID") if isinstance(result, dict) else None
            if not isinstance(message_ids, list) or len(message_ids) != 1:
                raise ValueError("invalid response")
            message_id = message_ids[0]
            if not isinstance(message_id, str) or not message_id.strip():
                raise ValueError("invalid response")
            return message_id
        except Exception:
            raise AppError(
                "SMS_SEND_FAILED",
                "短信发送状态暂未确认，请稍后再试；系统不会自动重复发送",
                502,
            ) from None


def create_sms_provider(settings: Settings) -> SmsProvider:
    return VolcSmsProvider(settings) if settings.sms_ready else UnconfiguredSmsProvider()
