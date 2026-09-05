# 第一阶段功能与 Bad Case 测试报告

> 测试日期：2026-09-02 至 2026-09-03  
> 源码目录：`mobile/`  
> 结论：第一阶段代码、双端 Release 构建和 Android 双版本主链路完成；iOS 完成页面与系统 Picker 入口验证，Picker 选择后的完整链路需真机或稳定自动化环境补测。

## 构建与静态检查

| 项目 | 结果 | 证据 |
|---|---:|---|
| ESLint | 通过 | `npm run check`，零错误 |
| TypeScript strict | 通过 | `tsc --noEmit`，零错误 |
| Jest | 通过 | 9 个套件、29 个测试 |
| Android Release | 通过 | Gradle `app:assembleRelease`，最终 ARM 构建 552 tasks，BUILD SUCCESSFUL |
| iOS Release Simulator | 通过 | Xcode 26.6，iOS 26.5，BUILD SUCCEEDED |
| iOS 中文路径兼容 | 通过 | Podfile 将 CocoaPods 子进程输出统一为 UTF-8，Pods 解析与构建成功 |

## Android 端到端

### API 36

- Release 冷启动，不依赖 Metro。
- 首页月历 → “记录这一杯” → 系统 Photo Picker。
- 图片复制到 App 私有目录并生成可恢复草稿。
- “奶油晨光”预览、强度调整、按住看原图。
- 填写表单并保存详情派生图、缩略图、Recipe 与 SQLite 数据。
- 月历出现记录；详情页可切换原图/滤镜图；继续编辑更新同一 `recordId`。
- 强制终止进程后重新启动，记录仍存在。

### API 24

- AndroidX Photo Picker 回移不可用时，DocumentsUI 回退可选图。
- 导入、编辑、保存、详情与进程重启恢复通过。
- App 不申请广泛存储、媒体或 Camera 权限。

## Bad Case

| 场景 | 预期 | 结果 |
|---|---|---:|
| 用户取消相册 | 返回来源页，不建空草稿 | 通过 |
| 用户取消相机 | 页面可继续操作，不崩溃 | 通过 |
| 8000×6000（48MP） | 允许导入 | 通过 |
| 8001×6000（超过 48MP） | 拒绝并提示 | 通过 |
| 伪造/不可读 JPG | 不进入编辑器，显示可理解错误 | 通过 |
| 建草稿数据库失败 | 清理新复制原图 | 自动化通过 |
| 保存数据库失败 | 清理新派生图，保留原图/草稿 | 自动化通过 |
| 第二张派生图失败 | 清理此前已生成的新文件 | 自动化通过 |
| 进程终止后恢复 | SQLite 记录与资源引用仍可读取 | Android 通过 |

## iOS 26.5 Simulator

- CocoaPods 安装成功：96 Pods / 97 dependencies。
- Release Simulator 构建、安装、冷启动和 SQLite 初始化通过。
- 首页、来源页、系统 Photos Picker 打开与取消通过。
- 发现并修复 Fabric 下月历日期叠在首行的问题；修复后六周网格截图复验通过。
- 系统 Photos 服务首次初始化期间 Picker 显示 `Loading...`；单独启动一次“照片”App后，约 30 秒可显示图库。这一现象需要真机复测。
- Picker 显示图库后，macOS Computer Use/Simulator 辅助功能桥对扩展内点击持续返回 `AXError.cannotComplete`，随后窗口句柄超时。由于无法实际点选缩略图，iOS 导入后的编辑/保存链路本轮不记为通过，也不记为应用失败。

## 产物

- Android 本地测试 Release：`artifacts/android/app-release.apk`
- 大小：约 65MB，包含真实手机使用的 `armeabi-v7a`、`arm64-v8a`；模拟器架构按需从源码构建。
- SHA-256：`7841e783a169374c62557a7d47c5450ff62f134c55e71225cfbe5b55f5d8c24f`
- Manifest 审计：minSdk 24、targetSdk 36；无相机、相册、存储或网络权限，仅保留 AndroidX 自动生成的应用内签名级权限。
- 签名：debug keystore，仅供本地安装测试；商店发布前必须更换正式签名并建议生成 AAB。

## 清理结果

- 已删除 Android `build/.cxx`、Skia/Reanimated/Worklets/SQLite 生成目录。
- 已删除约 3.5GB iOS 临时 DerivedData。
- 已删除不再对应最终源码的 Debug APK。
- 保留最新 Release APK、Android/JDK 工具链、Gradle 依赖缓存、iOS Runtime 和 Pods；当前磁盘可用空间约 27GB。

## 下一次验收优先级

1. 在一台 iPhone 真机完成相册/相机、HEIC、滤镜导出、保存和重启恢复。
2. 在 iOS 15.1 边界设备或可用运行时验证最低版本。
3. 用 8 张目标风格样片做双端色彩与性能校准。
4. 优化 Android 首次滤镜导出耗时，并增加明确进度反馈。
5. 完成 VoiceOver/TalkBack、动态字体、键盘和商店签名前验收。
