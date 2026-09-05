from dataclasses import dataclass

from app.core.errors import AppError


MAX_IMAGE_BYTES = 10 * 1024 * 1024


@dataclass(frozen=True)
class ValidatedImage:
    content: bytes
    mime_type: str
    extension: str


def validate_image(content: bytes) -> ValidatedImage:
    if not content:
        raise AppError("IMAGE_EMPTY", "请选择一张照片", 422)
    if len(content) > MAX_IMAGE_BYTES:
        raise AppError("IMAGE_TOO_LARGE", "照片不能超过 10MB", 413)
    if content.startswith(b"\xff\xd8\xff"):
        if not content.rstrip().endswith(b"\xff\xd9"):
            raise AppError("IMAGE_INVALID", "JPEG 文件不完整", 422)
        return ValidatedImage(content, "image/jpeg", "jpg")
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        if b"IEND" not in content[-32:]:
            raise AppError("IMAGE_INVALID", "PNG 文件不完整", 422)
        return ValidatedImage(content, "image/png", "png")
    raise AppError("IMAGE_TYPE_UNSUPPORTED", "目前只支持 JPEG 或 PNG 照片", 415)

