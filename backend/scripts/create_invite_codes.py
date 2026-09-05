#!/usr/bin/env python3
"""生成吨吨记内测邀请码。明文只在终端打印一次，数据库只保存哈希。"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import get_settings
from app.db import Base, create_database
from app.services.invites import create_invite_codes


def main() -> int:
    parser = argparse.ArgumentParser(description="生成吨吨记内测邀请码")
    parser.add_argument("--count", type=int, default=10, help="生成数量")
    parser.add_argument("--credits", type=int, default=None, help="每个邀请码兑换后获得的生成次数")
    parser.add_argument("--validity-days", type=int, default=None, help="邀请码可兑换有效期（天）")
    args = parser.parse_args()

    settings = get_settings()
    if not settings.invite_ready:
        print("缺少 INVITE_CODE_SECRET，请先在 .env 中配置（至少 32 字节随机字符串）。", file=sys.stderr)
        return 1

    credits = args.credits if args.credits is not None else settings.invite_default_credits
    validity = args.validity_days if args.validity_days is not None else settings.invite_validity_days
    if args.count < 1:
        print("--count 必须大于 0", file=sys.stderr)
        return 1

    engine, factory = create_database(settings.database_url)
    Base.metadata.create_all(engine)
    db = factory()
    try:
        codes = create_invite_codes(db, settings.invite_code_secret, args.count, credits, validity)
    finally:
        db.close()

    print(f"已生成 {len(codes)} 个邀请码（每码 {credits} 次，可兑换有效期 {validity} 天）：\n")
    for code in codes:
        print(code)
    print("\n明文只显示这一次，请立即分发；数据库只保存了哈希。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
