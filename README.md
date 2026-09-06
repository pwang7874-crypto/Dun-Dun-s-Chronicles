# 吨吨记 · Dun Dun's Chronicles

一款 AI 饮品生活日记 App：用一杯奶茶、咖啡记录生活，端侧免费修图，AI 艺术化创作。

> 「把今天喝的，贴进日历里。」

## 项目结构

| 目录 | 说明 |
|---|---|
| `mobile/` | React Native 双端 App（iOS 15.1+ / Android 7.0+） |
| `backend/` | FastAPI 服务端（邀请码登录、AI 生成、额度账本、TOS 存储） |
| `web-demo/` | 奶油风下载站 |

## 线上地址（国内 · 火山云）

| 服务 | 地址 |
|---|---|
| **下载站** | https://s696lb2hr5o1u5p17pvhk.apigateway-cn-beijing.volceapi.com/ |
| **后端 API** | https://sqrsgj1pohmr0qh650gju.apigateway-cn-beijing.volceapi.com/ |
| 健康检查 | https://sqrsgj1pohmr0qh650gju.apigateway-cn-beijing.volceapi.com/health/ready |

## 安装包

最新本地版本：[Android AI 进度与作品回填版（四架构，1.0.2-beta）](吨吨记-Android-AI进度与作品回填-20260906-全架构.apk)，约 362 MB / 345 MiB。同签名覆盖安装，不要先卸载。新增奶油生成进度、12 种风格大图、任务续接与作品自动回填；优化小主体原图区域读取，去掉樱花表情。160 项前端、8 项原生、25 项隔离后端相关测试通过；真实方舟联调 1 次成功。[本轮完整说明与验收边界](mobile/AI-CREATION-UPDATE.md)。

以下为上一版本记录：

2026-09-06 本地新版：[Android 清晰贴纸与陪伴动画版（ARM64，1.0.1-beta）](吨吨记-Android-清晰贴纸与陪伴动画-20260906-arm64.apk)，约 109 MB；与上一版测试签名一致，可覆盖安装，不要先卸载。包含离线通用主体抠图、旧贴纸用原图重做、小酱油摆件及按钮/导航动效。Jest 141 项与 Android 原生 6 项测试通过，iOS 模拟器构建通过；尚未做 Android 真机原图验收。详见 [本轮修改及验收说明](mobile/docs/2026-09-06-clear-stickers.md)。

**下面的线上下载链接仍是 9 月 5 日旧包，本轮未更新网站或公开 Release。**

| 平台 | 状态 |
|---|---|
| **Android** | [下载 APK](https://github.com/pwang7874-crypto/Dun-Dun-s-Chronicles/releases/download/v0.1.0-beta/DunDunJi-invite-sticker-20260905.apk)（测试签名，内测可用，正式发布前需更换签名） |
| **iOS** | 暂无 IPA —— 需要 Apple 开发者账号与签名证书后才能构建，目前只到模拟器版 |

## 核心功能

- **记录**：拍照 / 选图、六款免费滤镜、非破坏性编辑、月历回看
- **创作**：穿搭 / 美食主体抠图贴纸、海报排版、小红书 / 朋友圈分享
- **AI**：12 种艺术风格（服务端白名单）、邀请码登录、失败自动返还次数
- **收藏**：饮品护照、店铺色票、本月小刊、本地自然语言搜索

## 技术栈

- **移动端**：React Native 0.87 + TypeScript strict + Skia + OP-SQLite
- **服务端**：Python 3.11 + FastAPI + SQLAlchemy
- **AI**：火山方舟 Doubao-Seedream 5.0（图生图）
- **存储**：火山云 TOS 私有桶

## 本地运行

- App：见 [`mobile/README.md`](mobile/README.md)
- 服务端：见 [`backend/README.md`](backend/README.md)

## 当前状态

内测阶段：

- 后端与下载站已上线（火山云 veFaaS，cn-beijing）
- AI 生成需邀请码；登录采用「邀请码即登录」（无需手机号/短信）
- 后端数据库为临时 SQLite（函数实例重启会丢数据），正式上线需迁移 MySQL/PostgreSQL
- iOS 签名尚未完成（需 Apple 开发者账号）
