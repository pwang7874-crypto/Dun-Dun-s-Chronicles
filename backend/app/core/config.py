from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

    app_env: Literal["development", "test", "production"] = "development"
    app_public_base_url: str = "http://127.0.0.1:8000"
    database_url: str = "sqlite:///./data/dundunji.sqlite3"
    # 内测阶段允许使用 SQLite（函数实例重启可能丢失数据）；正式上线必须关闭。
    allow_sqlite: bool = False
    session_signing_secret: str = "development-only-session-secret-change-me"
    phone_hash_secret: str = "development-only-phone-hash-secret-change-me"
    allow_dev_auth: bool = False

    ark_api_key: str = ""
    ark_model_id: str = ""
    ark_base_url: str = "https://ark.cn-beijing.volces.com/api/v3"
    ark_timeout_seconds: float = Field(default=90, ge=10, le=180)

    storage_backend: Literal["local", "tos"] = "local"
    local_storage_dir: Path = Path("./storage")
    tos_access_key: str = ""
    tos_secret_key: str = ""
    tos_endpoint: str = ""
    tos_region: str = ""
    tos_bucket: str = ""

    volc_sms_access_key: str = Field(default="", repr=False)
    volc_sms_secret_key: str = Field(default="", repr=False)
    volc_sms_account: str = ""
    volc_sms_sign: str = ""
    volc_sms_template_id: str = ""
    volc_sms_code_param: str = Field(default="code", pattern=r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")
    volc_sms_region: str = Field(default="cn-north-1", min_length=1)
    volc_sms_timeout_seconds: float = Field(default=10, ge=1, le=30)

    invite_code_secret: str = Field(default="", repr=False)
    invite_default_credits: int = Field(default=10, ge=1, le=1000)
    invite_validity_days: int = Field(default=90, ge=1, le=3650)

    @property
    def ark_ready(self) -> bool:
        return bool(self.ark_api_key and self.ark_model_id)

    @property
    def tos_ready(self) -> bool:
        return self.storage_backend == "tos" and all(
            (self.tos_access_key, self.tos_secret_key, self.tos_endpoint, self.tos_region, self.tos_bucket)
        )

    @property
    def invite_ready(self) -> bool:
        return bool(self.invite_code_secret)

    @property
    def sms_ready(self) -> bool:
        return all(
            value.strip()
            for value in (
                self.volc_sms_access_key,
                self.volc_sms_secret_key,
                self.volc_sms_account,
                self.volc_sms_sign,
                self.volc_sms_template_id,
                self.volc_sms_code_param,
                self.volc_sms_region,
            )
        )

    @model_validator(mode="after")
    def reject_unsafe_production_defaults(self) -> "Settings":
        if self.app_env != "production":
            return self
        errors: list[str] = []
        if self.database_url.startswith("sqlite") and not self.allow_sqlite:
            errors.append("生产环境不能使用临时 SQLite")
        if len(self.session_signing_secret) < 32 or "development-only" in self.session_signing_secret:
            errors.append("SESSION_SIGNING_SECRET 未安全配置")
        if len(self.phone_hash_secret) < 32 or "development-only" in self.phone_hash_secret:
            errors.append("PHONE_HASH_SECRET 未安全配置")
        if self.allow_dev_auth:
            errors.append("生产环境不能启用 ALLOW_DEV_AUTH")
        if not self.ark_ready:
            errors.append("方舟模型未配置")
        if not self.tos_ready:
            errors.append("TOS 私有存储未配置")
        # 内测阶段登录使用邀请码，短信登录可选；后续上线手机号登录时再强制。
        if len(self.invite_code_secret) < 32 or "development-only" in self.invite_code_secret:
            errors.append("INVITE_CODE_SECRET 未安全配置")
        if errors:
            raise ValueError("；".join(errors))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
