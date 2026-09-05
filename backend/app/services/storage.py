from __future__ import annotations

from pathlib import Path
from typing import Protocol

from app.core.config import Settings
from app.core.errors import ConfigurationError


class ObjectStorage(Protocol):
    def put(self, key: str, content: bytes, content_type: str) -> None: ...

    def get(self, key: str) -> tuple[bytes, str]: ...

    def delete(self, key: str) -> None: ...


class LocalObjectStorage:
    def __init__(self, root: Path):
        self._root = root.resolve()
        self._root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        path = (self._root / key).resolve()
        if self._root not in path.parents:
            raise ValueError("invalid storage key")
        return path

    def put(self, key: str, content: bytes, content_type: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        path.with_suffix(path.suffix + ".type").write_text(content_type, encoding="utf-8")

    def get(self, key: str) -> tuple[bytes, str]:
        path = self._path(key)
        return path.read_bytes(), path.with_suffix(path.suffix + ".type").read_text(encoding="utf-8")

    def delete(self, key: str) -> None:
        path = self._path(key)
        path.unlink(missing_ok=True)
        path.with_suffix(path.suffix + ".type").unlink(missing_ok=True)


class TosObjectStorage:
    def __init__(self, settings: Settings):
        if not settings.tos_ready:
            raise ConfigurationError("TOS_NOT_CONFIGURED", "TOS 私有存储尚未配置")
        import tos

        self._bucket = settings.tos_bucket
        self._client = tos.TosClientV2(
            settings.tos_access_key,
            settings.tos_secret_key,
            settings.tos_endpoint,
            settings.tos_region,
        )

    def put(self, key: str, content: bytes, content_type: str) -> None:
        self._client.put_object(self._bucket, key, content=content, content_type=content_type)

    def get(self, key: str) -> tuple[bytes, str]:
        result = self._client.get_object(self._bucket, key)
        return result.read(), result.content_type or "application/octet-stream"

    def delete(self, key: str) -> None:
        self._client.delete_object(self._bucket, key)


def create_storage(settings: Settings) -> ObjectStorage:
    if settings.storage_backend == "tos":
        return TosObjectStorage(settings)
    if settings.app_env == "production":
        raise ConfigurationError("STORAGE_NOT_CONFIGURED", "生产环境必须使用 TOS 私有存储")
    return LocalObjectStorage(settings.local_storage_dir)

