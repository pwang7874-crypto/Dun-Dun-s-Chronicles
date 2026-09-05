# 吨吨记 API

吨吨记的服务端边界：手机号登录、AI 艺术化任务、会员每日额度和私有图片读取。普通记录、免费滤镜以及穿搭/美食主体抠图都在手机本地完成，不依赖本服务。

## 本地启动

需要 Python 3.11+ 与 `uv`。

```bash
cp .env.example .env
/Users/a1234/.local/bin/uv sync --dev
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

接口文档：`http://127.0.0.1:8000/docs`。健康检查：`/health/live` 与 `/health/ready`。

默认不会发送假验证码，也不会模拟 AI 成功。若要做本地接口联调，可只在开发环境设置 `ALLOW_DEV_AUTH=true`，再通过 `POST /api/v1/dev/session` 获取测试会话；生产环境会强制拒绝这一配置。

## 上线前配置

- `DATABASE_URL`：生产 PostgreSQL/MySQL 连接，不允许 SQLite。
- `SESSION_SIGNING_SECRET` 与 `PHONE_HASH_SECRET`：两份互相独立的随机密钥，至少 32 字节。
- `ARK_API_KEY` 与 `ARK_MODEL_ID`：火山方舟控制台中已开通的 Seedream 5.0 lite 推理接入点。
- `TOS_*`：私有桶、地域和访问密钥；生成结果不设置成公共读。
- `VOLC_SMS_ACCESS_KEY` / `VOLC_SMS_SECRET_KEY`：只保存在服务端、拥有短信发送权限的凭据。
- `VOLC_SMS_ACCOUNT`：火山短信消息组 ID（SendSms 的 `SmsAccount`），不是云账号 ID；`VOLC_SMS_SIGN` 为审核通过的签名内容，`VOLC_SMS_TEMPLATE_ID` 为审核通过的模板 ID。
- `VOLC_SMS_CODE_PARAM`：模板内的验证码变量名，默认 `code`；登录模板需匹配一个验证码变量并说明 5 分钟有效期。`VOLC_SMS_REGION` 默认 `cn-north-1`，`VOLC_SMS_TIMEOUT_SECONDS` 默认 10 秒。
- `INVITE_CODE_SECRET`：邀请码哈希用的独立随机密钥，至少 32 字节；`INVITE_DEFAULT_CREDITS` 默认 10（每个邀请码兑换后给的次数），`INVITE_VALIDITY_DAYS` 默认 90（邀请码可兑换有效期）。
- 通过官方 Python SDK 的 `UniversalApi` 调用 [SendSms](https://www.volcengine.com/docs/6361/67380?lang=zh)，使用 SDK 自带签名；SDK 与 HTTP 层均禁用自动重试，避免超时后重复发送、重复计费。供应商确认接收不等于短信已经送达。发送异常仅返回通用错误，不输出号码、验证码、凭据或供应商原始错误。不要开启 SDK 请求/响应调试日志。
- 开发环境缺少任一短信必需配置时返回 503，不发假短信；生产启动使用同一 `sms_ready` 校验，缺少配置直接拒绝启动。测试全部模拟 HTTP，不发送真实短信。
- 应用商店商品 ID 与服务端票据校验：接入前，客户端会员页只能展示方案，不能产生真实扣款或授予会员。

生产配置会在进程启动时做安全校验，缺少方舟、TOS、短信、数据库或安全密钥时直接拒绝启动。

## 额度规则

- 内测阶段：AI 生成需要邀请码。兑换邀请码获得次数，每成功生成扣 1 次，失败自动返还。
- 有效会员（支付接入后）：北京时间每天 1 次成功生成，不累计。
- 失败任务释放预占额度；相同幂等键不会重复生成或重复扣额。
- 图片仅接收 JPEG/PNG，最大 10 MB；风格提示词由服务端白名单管理，客户端不能提交任意提示词。

## 邀请码

先配置 `INVITE_CODE_SECRET`，再生成一批邀请码（明文只在终端打印一次，库里只存哈希）：

```bash
.venv/bin/python scripts/create_invite_codes.py --count 10 --credits 10 --validity-days 90
```

兑换接口为 `POST /api/v1/invite/redeem`，需要登录；兑换后额度写入用户 `invite_credits_remaining`，生成成功扣减、失败返还。

## 测试

```bash
.venv/bin/pytest
```

测试使用临时数据库、假短信与假 AI 提供方，不消耗真实云端额度。
