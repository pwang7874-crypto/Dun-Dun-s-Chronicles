#!/usr/bin/env python3
"""本地端到端联调：开发登录 → 兑换邀请码 → 真实生成 AI 图 → 读回验证。

用法：
  .venv/bin/python scripts/e2e_smoke.py <邀请码明文>
"""
from __future__ import annotations

import struct
import sys
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app


def make_png(w: int = 256, h: int = 256, rgb: tuple[int, int, int] = (232, 193, 142)) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    row = b"\x00" + bytes(rgb) * w
    idat = zlib.compress(row * h)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def main() -> int:
    if len(sys.argv) < 2:
        print("缺少邀请码明文，用法：.venv/bin/python scripts/e2e_smoke.py <邀请码>", file=sys.stderr)
        return 1
    invite_code = sys.argv[1]

    settings = get_settings()
    app = create_app(settings)
    png = make_png()

    with TestClient(app) as client:
        # 1. 开发登录
        login = client.post("/api/v1/dev/session", json={"phone": "13800000000"})
        if login.status_code != 200:
            print("1. 开发登录失败:", login.json(), file=sys.stderr)
            return 1
        headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}
        print("1. 开发登录 OK，phoneMasked =", login.json()["phoneMasked"])

        # 2. 兑换邀请码
        redeem = client.post("/api/v1/invite/redeem", json={"code": invite_code}, headers=headers)
        if redeem.status_code != 200:
            print("2. 兑换邀请码失败:", redeem.status_code, redeem.json(), file=sys.stderr)
            return 1
        print("2. 兑换邀请码 OK:", redeem.json())

        # 3. 真实生成（同步调用火山方舟 Seedream）
        gen = client.post(
            "/api/v1/ai/generations",
            headers=headers,
            data={"idempotency_key": "e2e-smoke-001", "record_id": "e2e-record-1", "style_id": "cream-poster"},
            files={"image": ("drink.png", png, "image/png")},
        )
        if gen.status_code != 201:
            print("3. 生成失败:", gen.status_code, gen.json(), file=sys.stderr)
            return 1
        job = gen.json()
        print("3. 生成 OK，jobId =", job["jobId"], "，status =", job["status"])

        # 4. 读回生成结果
        image = client.get(job["outputUrl"], headers=headers)
        if image.status_code != 200:
            print("4. 读回图片失败:", image.status_code, file=sys.stderr)
            return 1
        out = Path("data/e2e-output.jpg")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(image.content)
        print(f"4. 读回图片 OK，{len(image.content)} 字节 → {out}")

        # 5. 额度核对（应该扣了 1 次）
        ent = client.get("/api/v1/me/entitlements", headers=headers).json()
        print("5. 剩余创作次数 =", ent["inviteCreditsRemaining"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
