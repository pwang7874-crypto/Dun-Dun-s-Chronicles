from __future__ import annotations

import base64
from typing import Protocol

import httpx

from app.core.config import Settings
from app.core.errors import AppError, ConfigurationError
from app.services.images import validate_image


class AiImageProvider(Protocol):
    def generate(self, image: bytes, mime_type: str, prompt: str) -> bytes: ...


class ArkSeedreamProvider:
    def __init__(self, settings: Settings):
        self._settings = settings

    def generate(self, image: bytes, mime_type: str, prompt: str) -> bytes:
        if not self._settings.ark_ready:
            raise ConfigurationError("ARK_NOT_CONFIGURED", "火山方舟模型尚未配置")
        encoded = base64.b64encode(image).decode("ascii")
        request_body = {
            "model": self._settings.ark_model_id,
            "prompt": prompt,
            "image": f"data:{mime_type};base64,{encoded}",
            "size": "2K",
            "response_format": "url",
            "watermark": False,
            "sequential_image_generation": "disabled",
        }
        headers = {"Authorization": f"Bearer {self._settings.ark_api_key}"}
        try:
            with httpx.Client(timeout=self._settings.ark_timeout_seconds) as client:
                response = client.post(
                    f"{self._settings.ark_base_url.rstrip('/')}/images/generations",
                    json=request_body,
                    headers=headers,
                )
                response.raise_for_status()
                payload = response.json()
                item = payload["data"][0]
                if item.get("b64_json"):
                    result = base64.b64decode(item["b64_json"], validate=True)
                elif item.get("url"):
                    download = client.get(item["url"])
                    download.raise_for_status()
                    result = download.content
                else:
                    raise KeyError("output")
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            raise AppError("ARK_GENERATION_FAILED", "AI 暂时没有生成成功，请稍后重试", 502) from exc
        return validate_image(result).content

