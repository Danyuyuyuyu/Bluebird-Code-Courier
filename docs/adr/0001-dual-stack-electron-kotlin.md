# 双栈技术选型：Windows 端 Electron，Android 端 Kotlin + Jetpack Compose

v1 先交付 Windows 端、v1.1 再交付 Android 端，两端允许使用不同技术栈、各取平台最优解；因此 Windows 端选 Electron，Android 端选 Kotlin + Jetpack Compose。代价是业务逻辑两套实现，数据结构与抓取/快照规则以 v1 spec 为准对齐。

## Considered Options

- **Tauri 2（仅 Windows，或桌面+移动一套前端）**：安装包更小、内存更低，但要引入 Rust 工具链，且系统 WebView 渲染与原型预览存在差异。
- **Flutter 双端一套代码**：跨端总成本最低，但两个 HTML 原型的 UI 需全部重写、Dart 是新语言，且 Windows 端并非平台最优。
- **WinUI 3 / WPF**：Windows 体验最地道，但现有原型资产归零，Android 端后期没有好路。
- **Kotlin Multiplatform + Compose 双端**：可共享业务逻辑，但桌面端尚未完全成熟，与"Windows 先行"的优先级冲突。

## Consequences

- GitHub 抓取、本地存储结构、快照规则在两端各实现一遍，均须对齐 v1 spec。
- Android 端是独立实现，预计比同栈方案多四到六成工作量。
- 若后续要压缩成本，可改用 Tauri 移动端承载 Windows 端同一套前端（换壳不换 UI）。
