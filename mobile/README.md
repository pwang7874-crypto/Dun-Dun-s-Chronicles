# 吨吨记（内部工程名 DrinkDiary）

面向喜欢记录生活、奶茶和咖啡用户的本地优先移动 App。当前客户端已进入成熟阶段：以奶油纸张、可爱贴纸和突出月历为统一视觉，免费记录与本地创作可独立使用；AI、短信账号和商店支付通过真实服务边界接入，不用 Mock 冒充成功。

> 当前开发状态：18 个测试套件、63 项测试全部通过；iOS 26.5 模拟器已完成首次新手教程、四主模块、滤镜/裁切/旋转/翻转导出、海报/月刊保存、收藏、搜索、护照和失败保护的交互验收。包含最新纸质轮廓贴纸、画布触控与心跳动效的 Android 四架构 Release 测试包已保存在 [吨吨记-Android-奶油贴纸交互版-20260904.apk](../吨吨记-Android-奶油贴纸交互版-20260904.apk)；AI/账号服务端骨架已实现并通过测试，真实方舟、短信、TOS、数据库和商店配置仍需上线凭据。详见 [成熟阶段状态](docs/mature-stage-status.md)。

## 已实现的用户闭环

1. 从系统相机或相册选择一张静态照片。
2. 先把原图复制进 App 私有目录，再创建可恢复草稿。
3. 使用六款端侧免费滤镜，支持强度、亮度、对比度、饱和度、色温、比例裁切、旋转、翻转、拉直和撤销/重做，所有处理均为非破坏导出。
4. 店铺、饮品名与类别、糖度、温度/冰量必填；日期、城市、心情和一句话共同组成生活记录。
5. 保存派生图、缩略图、版本化滤镜配方和 SQLite 元数据。
6. 在月历按日期回看，进入详情切换原图/滤镜图。
7. 从详情继续编辑时更新同一条记录，原图不覆盖，历史派生资产保留。
8. 冷启动时从 SQLite 读取记录，并在月历提示尚未完成的草稿。
9. 每个新店铺解锁一枚原创“饮品色票”，同店重复到访累计杯数；另有真实进度驱动的里程色票。
10. 创作页横向选择滤镜、裁切比例、贴纸和排版；选择会进入最终分享海报，不需要长距离纵向浏览。
11. 发布页生成小红书/朋友圈文案，支持编辑、复制、保存完整海报和系统分享。
12. 个人页支持收藏、历史海报、饮品护照、城市/类别挑战和本地自然语言搜索。
13. 自动生成可编辑的本月小刊，可复制月度总结并保存到系统照片。
14. 隐私页可导出 JSON，并在二次确认后删除数据库和私有照片。
15. AI 任务、会员和账号入口在外部服务未配置时给出真实状态，不扣次数、不假登录、不假支付。
16. 每杯记录可同时加入穿搭照和美食照；手机端免费自动抠出真实透明主体并生成带奶油纸边、压纹高光与轮廓投影的贴纸，允许在创作画布中拖动、双指缩放和旋转，并进入记录详情与分享海报。设备不支持或识别失败时会明确提示，不生成方形假贴纸。
17. 首次打开自动展示四页可爱新手指南，讲清记录、生活贴图、免费滤镜/AI 与发布收藏；完成或跳过后不再自动打扰，也可随时从“我的 → 新手指南”重新打开。

免费编辑不上传照片；只有用户主动开始 AI 生成或系统分享时内容才会离开本机。AI 服务使用 HTTPS 服务端适配器，供应商密钥只允许存在服务端。

## 技术基线

| 项目 | 当前值 |
|---|---|
| React Native | 0.87.1（Community CLI） |
| React / TypeScript | React 19.2.3 / TypeScript strict |
| iOS 下限 | 15.1 |
| Android 下限 | Android 7.0 / API 24 |
| 本地元数据 | OP-SQLite 18.1.4，Schema V9 + WAL + 事务迁移 |
| 图片资产 | App 私有目录 + SHA-256 + 非破坏性版本 |
| 图片处理 | React Native Skia 2.11.2，共享 Filter Catalog |
| 测试 | Jest、React Native Testing Library；Maestro 冒烟流已建 |

所有业务依赖均在 `package.json` 和 `package-lock.json` 中锁定。项目启用 React Native New Architecture 与 Hermes。

## 目录

```text
src/
├── app/                    # 启动、导航、依赖装配
├── assets/filters/         # 版本化免费滤镜 Catalog
├── design-system/          # 纸感、轻暖的视觉 token 与组件
├── domain/                 # 模型、Schema、错误和 Port
├── features/
│   ├── calendar/           # 月历与草稿恢复入口
│   ├── onboarding/         # 首次教程与个人页重播入口
│   ├── photo-source/       # 相机/相册与草稿用例
│   ├── record-editor/      # Skia 预览、表单与保存用例
│   ├── record-detail/      # 回看、原图对比、继续编辑
│   ├── create-studio/      # 免费滤镜与 AI 风格入口
│   ├── publish-studio/     # 小红书/朋友圈海报与文案
│   ├── profile/            # 饮品柜、历史贴页与会员入口
│   ├── stamps/             # 原创店铺色票与里程解锁
│   ├── passport/           # 城市护照与挑战
│   ├── search/             # 本地自然语言回忆搜索
│   └── monthly-recap/      # 可编辑、可保存的本月小刊
├── infrastructure/
│   ├── media/              # 系统 Picker 与私有资产适配器
│   ├── persistence/sqlite/ # V1 迁移与 Repository
│   ├── rendering/          # 共享滤镜与离屏导出
│   ├── network/            # HTTPS AI 服务边界
│   └── logging/            # 隐私过滤日志
└── shared/                 # 日期、ID、文本归一化
```

依赖方向是 Screen → Feature 用例 → Domain Port → Infrastructure。页面不直接执行 SQL、不拼绝对路径，也不接触原生库的错误原文。

## 本机已验证命令

```sh
npm run check
```

该命令依次执行 ESLint、`tsc --noEmit` 和 Jest。当前为 18 个测试套件、63 个测试全部通过。

也可单独验证两端生产 Bundle：

```sh
./node_modules/.bin/react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /private/tmp/drink-diary-ios.jsbundle --assets-dest /private/tmp/drink-diary-ios-assets --max-workers 2
./node_modules/.bin/react-native bundle --platform android --dev false --entry-file index.js --bundle-output /private/tmp/drink-diary-android.jsbundle --assets-dest /private/tmp/drink-diary-android-assets --max-workers 2
```

两条命令均已通过。Metro 会报告一条 React Native 0.87 依赖内部 `ReactNativeFeatureFlags` 的 exports 回退警告，但 Bundle 能正确完成。除此之外，当前源码已通过 Android Release 和 iOS Simulator Release 原生构建。

## 原生开发环境与复现

当前 Mac 已安装并验证 Xcode 26.6、iOS 26.5 Runtime、CocoaPods，以及项目内隔离的 JDK 17/Android SDK/NDK。以下步骤用于其他开发机复现。

### iOS

1. 从 App Store 安装完整 Xcode，并首次启动完成组件安装。
2. 将 Command Line Tools 指向完整 Xcode。
3. 在项目目录安装 Ruby 依赖和 Pods：

```sh
bundle config set --local path vendor/bundle
bundle install
bundle exec pod install --project-directory=ios
npm run ios
```

工程的 Deployment Target 已是 iOS 15.1，`Info.plist` 只声明相机和选择照片所需用途说明，不声明定位权限。

### Android

1. 安装 Android Studio 和 JDK 17。
2. 在 SDK Manager 安装 Android SDK Platform/Build Tools 37、Platform Tools、NDK `27.1.12297006` 与模板要求的 CMake。
3. 配置 `ANDROID_HOME`，创建 API 24 边界模拟器和一个当前稳定系统模拟器。
4. 运行：

```sh
npm run android
```

Android 工程使用 `minSdkVersion 24`、`allowBackup=false` 和竖屏。系统图片选择器/相机 Intent 不要求 App 自行申请广泛相册或 Camera 权限；API 24–29 已配置 Android Photo Picker 回移。主 Manifest 移除旧 `READ_EXTERNAL_STORAGE`，仅为 Android 8 及更早系统保存海报保留 `maxSdkVersion=28` 的写入权限；`INTERNET` 用于用户主动发起的 AI 与账号服务，不会让免费修图自动上传照片。

环境准备后先执行 `npm run doctor`，再按 [兼容性矩阵](docs/compatibility-matrix.md) 完成边界版本与真机验证。

## 本地数据与隐私

- SQLite 数据库由 OP-SQLite 放在平台 App 私有数据库目录。
- 原图、派生图与缩略图位于私有 `DrinkDiary/media/`，数据库只保存受控相对路径。
- iOS 私有目录标记为不进入云备份，并使用“首次解锁后可访问”的文件保护级别；Android 禁用 App 系统备份。
- 原图先写临时文件、计算 SHA-256，再移动到最终位置；保存前会重新核对大小和校验值。
- 用户文字、照片 URI、绝对路径和堆栈不会写入产品日志。
- 卸载、换机和跨设备恢复不在第一阶段承诺范围。

## 安全告警记录

2026-09-02 的 `npm audit` 为 0 critical、8 high、6 moderate：

- high 来自 React Native 0.87.1 自带 Metro/`image-size` 工具链；npm 给出的自动修复是降级 React Native 0.86.3，会改变已确认技术基线，因此未执行 `audit fix --force`。
- moderate 来自 React Navigation 的 `query-string`/`decode-uri-component` 传递依赖，当前无可用修复。本阶段没有外部深链配置，也不把不可信 URL 送入导航解析器。

升级或替换依赖前必须重新通过双端 Bundle、原生构建和主链路回归。

## 项目文档

- [架构与数据一致性](docs/architecture.md)
- [第一阶段状态与未完成项](docs/phase-1-status.md)
- [第一阶段功能与 Bad Case 测试报告](docs/phase-1-test-report.md)
- [兼容性矩阵](docs/compatibility-matrix.md)
- [前端技术适配声明：奶油贴纸日历与饮印册](docs/frontend-adaptation-cream-sticker-v1.md)
- 工作区上层的 [PRD](../PRD_AI饮品生活日记_V1.0.md)
- 工作区上层的 [第一阶段开发声明 V1.2](../第一阶段开发声明_AI饮品生活日记.md)
