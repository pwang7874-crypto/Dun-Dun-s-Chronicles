from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ErrorBody(BaseModel):
    code: str
    message: str


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "吨吨记"
    environment: str
    components: dict[str, bool]


class SmsRequest(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def mainland_mobile(cls, value: str) -> str:
        normalized = value.strip().replace(" ", "")
        if normalized.startswith("+86"):
            normalized = normalized[3:]
        if len(normalized) != 11 or not normalized.startswith("1") or not normalized.isdigit():
            raise ValueError("请输入正确的中国大陆手机号")
        return normalized


class SmsChallengeResponse(BaseModel):
    challengeId: str
    expiresIn: int = 300


class InviteLoginRequest(BaseModel):
    code: str = Field(min_length=4, max_length=64)


class SmsVerifyRequest(BaseModel):
    challengeId: str = Field(min_length=10, max_length=80)
    code: str = Field(pattern=r"^\d{6}$")


class SessionResponse(BaseModel):
    accessToken: str
    tokenType: Literal["bearer"] = "bearer"
    expiresIn: int
    phoneMasked: str


AiJobStatus = Literal["queued", "processing", "completed", "failed"]


class AiGenerationResponse(BaseModel):
    jobId: str
    status: AiJobStatus
    styleId: str
    outputUrl: str | None = None
    errorCode: str | None = None
    errorMessage: str | None = None
    createdAt: datetime
    updatedAt: datetime


class EntitlementResponse(BaseModel):
    membershipTier: Literal["free", "member"]
    membershipExpiresAt: datetime | None
    aiRemainingToday: int
    entitlementKind: Literal["invite", "daily", "none"]
    resetsAt: datetime | None
    inviteCreditsRemaining: int


class InviteRedeemRequest(BaseModel):
    code: str = Field(min_length=4, max_length=64)


class InviteRedeemResponse(BaseModel):
    creditsGranted: int
    inviteCreditsRemaining: int


class DevSessionRequest(BaseModel):
    phone: str = "13800000000"

    @field_validator("phone")
    @classmethod
    def safe_dev_phone(cls, value: str) -> str:
        if len(value) != 11 or not value.isdigit():
            raise ValueError("开发手机号必须是 11 位数字")
        return value

