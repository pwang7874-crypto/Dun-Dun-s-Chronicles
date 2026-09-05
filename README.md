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

| 平台 | 状态 |
|---|---|
| **Android** | [下载 APK](https://github.com/pwang7874-crypto/Dun-Dun-s-Chronicles/releases/download/v0.1.0-beta/DunDunJi-invite-release-20260905.apk)（测试签名，内测可用，正式发布前需更换签名） |
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
