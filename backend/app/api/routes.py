from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, Header, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import AppError, AuthenticationError
from app.models import AiGenerationJob, User
from app.schemas import (
    AiGenerationResponse,
    DevSessionRequest,
    EntitlementResponse,
    HealthResponse,
    InviteLoginRequest,
    InviteRedeemRequest,
    InviteRedeemResponse,
    SessionResponse,
    SmsChallengeResponse,
    SmsRequest,
    SmsVerifyRequest,
)
from app.services.entitlements import entitlement_snapshot
from app.services.images import MAX_IMAGE_BYTES
from app.services.invites import redeem_invite_code
from app.services.prompts import STYLE_CATALOG


router = APIRouter()


def get_db(request: Request):
    db: Session = request.app.state.session_factory()
    try:
        yield db
    finally:
        db.close()


def current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AuthenticationError()
    claims = request.app.state.tokens.verify(authorization.split(" ", 1)[1].strip())
    user = db.get(User, claims.user_id)
    if not user:
        raise AuthenticationError()
    return user


def job_response(job: AiGenerationJob) -> AiGenerationResponse:
    return AiGenerationResponse(
        jobId=job.id,
        status=job.status,
        styleId=job.style_id,
        outputUrl=f"/api/v1/ai/generations/{job.id}/image" if job.output_key else None,
        errorCode=job.error_code,
        errorMessage=job.error_message,
        createdAt=job.created_at,
        updatedAt=job.updated_at,
    )


@router.get("/health/live", response_model=HealthResponse, tags=["system"])
def liveness(request: Request) -> HealthResponse:
    settings = request.app.state.settings
    return HealthResponse(
        environment=settings.app_env,
        components={"database": True, "ark": settings.ark_ready, "storage": request.app.state.storage_ready, "sms": request.app.state.sms_ready},
    )


@router.get("/health/ready", response_model=HealthResponse, tags=["system"])
def readiness(request: Request, db: Session = Depends(get_db)) -> HealthResponse:
    db.execute(text("SELECT 1"))
    settings = request.app.state.settings
    components = {
        "database": True,
        "ark": settings.ark_ready,
        "storage": request.app.state.storage_ready,
        "sms": request.app.state.sms_ready,
    }
    if settings.app_env == "production" and not all(components.values()):
        raise AppError("SERVICE_NOT_READY", "生产服务配置尚未完成", 503)
    return HealthResponse(environment=settings.app_env, components=components)


@router.post("/api/v1/auth/sms/request", response_model=SmsChallengeResponse, tags=["auth"])
def request_sms(payload: SmsRequest, request: Request) -> SmsChallengeResponse:
    challenge = request.app.state.auth_service.request_code(payload.phone)
    return SmsChallengeResponse(challengeId=challenge.id)


@router.post("/api/v1/auth/sms/verify", response_model=SessionResponse, tags=["auth"])
def verify_sms(payload: SmsVerifyRequest, request: Request) -> SessionResponse:
    user, token = request.app.state.auth_service.verify_code(payload.challengeId, payload.code)
    return SessionResponse(accessToken=token, expiresIn=30 * 24 * 60 * 60, phoneMasked=f"1** **** {user.phone_last4}")


@router.post("/api/v1/auth/invite", response_model=SessionResponse, tags=["auth"])
def login_with_invite(payload: InviteLoginRequest, request: Request) -> SessionResponse:
    settings = request.app.state.settings
    if not settings.invite_ready:
        raise AppError("INVITE_NOT_CONFIGURED", "邀请码登录尚未配置", 503)
    user, token = request.app.state.auth_service.login_with_invite(payload.code)
    return SessionResponse(
        accessToken=token,
        expiresIn=30 * 24 * 60 * 60,
        phoneMasked=f"邀请码 **** {user.phone_last4}",
    )


@router.post("/api/v1/dev/session", response_model=SessionResponse, tags=["development"])
def dev_session(payload: DevSessionRequest, request: Request) -> SessionResponse:
    settings = request.app.state.settings
    if settings.app_env == "production" or not settings.allow_dev_auth:
        raise AppError("DEV_AUTH_DISABLED", "开发登录没有启用", 404)
    user, token = request.app.state.auth_service.create_dev_session(payload.phone)
    return SessionResponse(accessToken=token, expiresIn=30 * 24 * 60 * 60, phoneMasked=f"1** **** {user.phone_last4}")


@router.get("/api/v1/ai/styles", tags=["ai"])
def list_styles() -> dict[str, list[dict[str, str]]]:
    return {"styles": [{"id": item.id, "name": item.name} for item in STYLE_CATALOG.values()]}


@router.get("/api/v1/me/entitlements", response_model=EntitlementResponse, tags=["membership"])
def entitlements(user: User = Depends(current_user), db: Session = Depends(get_db)) -> EntitlementResponse:
    snapshot = entitlement_snapshot(db, user, datetime.now(timezone.utc))
    return EntitlementResponse(
        membershipTier=snapshot.membership_tier,
        membershipExpiresAt=snapshot.membership_expires_at,
        aiRemainingToday=snapshot.ai_remaining,
        entitlementKind=snapshot.kind,
        resetsAt=snapshot.resets_at,
        inviteCreditsRemaining=snapshot.invite_credits_remaining,
    )


@router.post("/api/v1/invite/redeem", response_model=InviteRedeemResponse, tags=["invite"])
def redeem_invite(
    payload: InviteRedeemRequest,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> InviteRedeemResponse:
    settings = request.app.state.settings
    if not settings.invite_ready:
        raise AppError("INVITE_NOT_CONFIGURED", "邀请码功能尚未配置", 503)
    granted, remaining = redeem_invite_code(
        db, user, payload.code, settings.invite_code_secret, datetime.now(timezone.utc)
    )
    return InviteRedeemResponse(creditsGranted=granted, inviteCreditsRemaining=remaining)


@router.post("/api/v1/ai/generations", response_model=AiGenerationResponse, status_code=201, tags=["ai"])
async def create_generation(
    request: Request,
    user: User = Depends(current_user),
    image: UploadFile = File(),
    idempotency_key: str = Form(),
    record_id: str = Form(),
    style_id: str = Form(),
) -> AiGenerationResponse:
    content = await image.read(MAX_IMAGE_BYTES + 1)
    job = await run_in_threadpool(
        request.app.state.generation_service.create,
        user.id,
        record_id,
        style_id,
        idempotency_key,
        content,
    )
    return job_response(job)


@router.get("/api/v1/ai/generations/{job_id}", response_model=AiGenerationResponse, tags=["ai"])
def get_generation(job_id: str, request: Request, user: User = Depends(current_user)) -> AiGenerationResponse:
    job = request.app.state.generation_service.get(user.id, job_id)
    if not job:
        raise AppError("AI_JOB_NOT_FOUND", "生成任务不存在", 404)
    return job_response(job)


@router.get("/api/v1/ai/generations/{job_id}/image", tags=["ai"])
def get_generation_image(job_id: str, request: Request, user: User = Depends(current_user)) -> Response:
    job = request.app.state.generation_service.get(user.id, job_id)
    if not job or not job.output_key or job.status != "completed":
        raise AppError("AI_OUTPUT_NOT_FOUND", "生成图片还没有准备好", 404)
    content, content_type = request.app.state.storage.get(job.output_key)
    return Response(content=content, media_type=content_type, headers={"Cache-Control": "private, max-age=300"})
