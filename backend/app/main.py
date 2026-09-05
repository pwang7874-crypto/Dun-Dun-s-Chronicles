from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.core.security import SessionTokenService
from app.db import Base, create_database
from app.services.ai_provider import AiImageProvider, ArkSeedreamProvider
from app.services.auth import AuthService
from app.services.generation import AiGenerationService
from app.services.sms import SmsProvider, UnconfiguredSmsProvider, create_sms_provider
from app.services.storage import LocalObjectStorage, ObjectStorage, create_storage


def create_app(
    settings: Settings | None = None,
    *,
    ai_provider: AiImageProvider | None = None,
    sms_provider: SmsProvider | None = None,
    storage: ObjectStorage | None = None,
) -> FastAPI:
    config = settings or get_settings()
    engine, session_factory = create_database(config.database_url)
    Base.metadata.create_all(engine)
    selected_storage = storage or create_storage(config)
    selected_sms = sms_provider or create_sms_provider(config)
    tokens = SessionTokenService(config.session_signing_secret)

    app = FastAPI(
        title="吨吨记 API",
        version="0.1.0",
        description="生活饮品记录、端侧贴图、AI 艺术化与会员权益服务。",
    )
    app.state.settings = config
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.tokens = tokens
    app.state.storage = selected_storage
    app.state.storage_ready = config.tos_ready if config.app_env == "production" else isinstance(selected_storage, LocalObjectStorage) or config.tos_ready
    app.state.sms_ready = not isinstance(selected_sms, UnconfiguredSmsProvider)
    app.state.auth_service = AuthService(session_factory, selected_sms, tokens, config.phone_hash_secret, config.invite_code_secret)
    app.state.generation_service = AiGenerationService(
        session_factory,
        ai_provider or ArkSeedreamProvider(config),
        selected_storage,
    )

    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, error: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code,
            content={"error": {"code": error.code, "message": error.message}},
        )

    app.include_router(router)
    return app


app = create_app()
