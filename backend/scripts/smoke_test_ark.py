#!/usr/bin/env python3
"""火山方舟 Seedream 真实联调冒烟：用一张图片生成一张艺术图。

用法：
  .venv/bin/python scripts/smoke_test_ark.py [图片路径] [提示词]

不传图片时，脚本会生成一张纯色 PNG 作为测试输入。
"""
from __future__ import annotations

import struct
import sys
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import get_settings
from app.services.ai_provider import ArkSeedreamProvider


def make_solid_png(width: int = 256, height: int = 256, rgb: tuple[int, int, int] = (232, 193, 142)) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    row = b"\x00" + bytes(rgb) * width
    idat = zlib.compress(row * height)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def main() -> int:
    settings = get_settings()
    if not settings.ark_ready:
        print("缺少 ARK_API_KEY 或 ARK_MODEL_ID，请先配置 backend/.env", file=sys.stderr)
        return 1

    image_path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    prompt = sys.argv[2] if len(sys.argv) > 2 else "把这张饮品照片设计成原创的奶油系饮品手帐海报，保留杯子主体，奶油白与蜂蜜黄配色，留白充足。"
    if image_path:
        image = image_path.read_bytes()
        mime = "image/png" if image_path.suffix.lower() == ".png" else "image/jpeg"
        print(f"测试图片：{image_path}（{len(image)} 字节）")
    else:
        image = make_solid_png()
        mime = "image/png"
        print("测试图片：内置纯色 PNG（256×256）")

    print(f"调用模型：{settings.ark_model_id}")
    provider = ArkSeedreamProvider(settings)
    try:
        result = provider.generate(image, mime, prompt)
    except Exception as exc:  # noqa: BLE001
        print(f"调用失败：{exc}", file=sys.stderr)
        return 1

    out = Path("data/smoke-test-output.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(result)
    print(f"成功：输出 {len(result)} 字节 → {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
