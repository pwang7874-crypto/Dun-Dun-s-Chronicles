# 第一阶段开发状态

> 更新时间：2026-09-03  
> 结论：第一阶段功能实现与双端 Release 构建已完成；Android API 24/API 36 主链路已跑通，iOS 26.5 已完成启动、页面与系统相册入口验证。真机、iOS 最低版本和 iOS 相册选择后的完整链路仍属于发布前验收项，因此暂不标记为正式发布完成。

## 已完成

- React Native Community CLI 0.87.1 双端工程，支持目标为 iOS 15.1+、Android API 24+。
- TypeScript strict、领域模型、Zod V1 Schema、统一 `AppError`。
- OP-SQLite V1 迁移，记录/资产/配方表、索引、WAL 和事务 Repository。
- 系统相机/相册适配器；取消选择不会创建空草稿。
- 私有资产 Store；原图复制、受控相对路径、100MB/48MP 保护线、SHA-256 校验、临时文件和非破坏性派生资产。
- “奶油晨光”免费端侧滤镜、0–100 强度、按住看原图、Skia 预览和离屏 JPEG 导出。
- 月历、照片来源、记录编辑、详情四个页面；草稿恢复入口与同记录继续编辑。
- iOS 相机/相册用途说明、Android `allowBackup=false`、双端竖屏范围。
- Catchable 失败补偿：建草稿数据库失败时清理已复制原图；渲染、文件写入或数据库保存失败时清理本次新派生图，同时保留原图和原草稿。
- 修复 iOS/Fabric 月历日期绝对定位错位：每个日期格使用明确的原生布局容器。
- Xcode 26.6 + iOS 26.5 Simulator Release 构建、安装、无 Metro 冷启动和月历截图复验通过。
- Android API 24 与 API 36 模拟器完成相册导入、滤镜、保存、详情、重启恢复等测试。
- 当前源码的 Android Release APK 已重新构建并保存在 `artifacts/android/app-release.apk`。
- `npm run check` 全绿：9 个测试套件、29 个测试，ESLint 零错误，TypeScript 零错误。

## 已验证的关键场景

- Android API 36：系统 Photo Picker → 私有原图 → 滤镜编辑 → 表单保存 → 月历/详情 → 原图与滤镜图切换 → 继续编辑同一记录。
- Android API 24：DocumentsUI 回退选择器 → 导入 → 编辑 → 保存 → 冷启动恢复。
- Android：Release 不依赖 Metro；进程终止后记录仍可恢复。
- Android 异常输入：48MP 边界接受，超过 48MP 拒绝；伪造 JPG/不可用文件给出可理解错误；相机/相册取消不崩溃、不产生空草稿。
- JS/领域层：导入、Schema、迁移、滤镜配方、日期、按钮状态，以及三类文件/数据库失败补偿均有自动化覆盖。
- iOS 26.5：Release 安装启动、SQLite 初始化、首页、月历、照片来源页、相册 Picker 打开与取消均通过；Picker 首次初始化约 30 秒后可正常显示图库。

## 发布前仍需完成

- iOS 15.1 边界系统的模拟器或真机验证。
- iOS 从 Picker 点选照片后的导入、Skia 导出、SQLite 保存和重启恢复完整链路。此次 Photos Picker 已正常显示，但 macOS Simulator 自动化桥在扩展内点击时返回 `AXError.cannotComplete`，无法把后续步骤记为通过。
- iOS 与 Android 各至少一台真实设备测试相机、HEIC/方向/色彩、低内存和后台恢复。
- 8 张授权饮品样片的双端视觉一致性和目标用户审美评审。
- VoiceOver/TalkBack、动态字体、键盘遮挡及完整 Maestro/XCTest/JUnit 验收。
- 正式应用图标、商店发布签名、隐私政策与商店素材。

## 已知风险与性能观察

- iOS 26.5 Simulator 的 Photos 服务首次启动较慢；先启动一次系统“照片”App后，Picker 约 30 秒可完成初始化。需要在真机确认这只是模拟器冷启动现象。
- Android API 36 模拟器首次生成滤镜派生图约需 30 秒，功能正确但需要后续做性能优化和进度反馈。
- SQLite 与文件系统不能组成同一个跨介质事务。当前会补偿可捕获失败；若进程恰好在文件落盘后、数据库提交前被操作系统杀死，仍可能留下未引用派生文件，启动孤儿扫描留待后续阶段。
- Release APK 当前使用 debug keystore，仅适用于本地安装测试，不可直接提交商店。
- “尽量支持所有 iOS 版本”的现实下限是 iOS 15.1；这是当前 React Native/Hermes 原生依赖的最低基线。

完整证据见 [第一阶段测试报告](phase-1-test-report.md) 与 [兼容性矩阵](compatibility-matrix.md)。
