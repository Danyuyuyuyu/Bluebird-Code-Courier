# OCTO 仓库监控器

> 本地优先的 GitHub 仓库监控桌面应用：把关注的仓库放进监控清单，一眼看出"有没有新东西"，并让指标趋势随使用自然积累。

数据全部留在本机，打开即用、关闭即停，不留后台进程。Windows 先行（Electron）。

- **要构建、改代码或发版** → [开发](#-开发)

---

# 🗒 目录

- [📖 这是什么](#-这是什么)
- [📦 安装](#-安装)
- [🔑 首次启动：配置访问令牌](#-首次启动配置访问令牌)
- [📋 日常使用](#-日常使用)
- [💥 出错时会怎样](#-出错时会怎样)
- [🔒 数据与隐私](#-数据与隐私)
- [🖥 窗口与后台行为](#-窗口与后台行为)

**开发**

- [🔧 技术栈](#-技术栈)
- [🏗 架构](#-架构)
- [📌 前置要求](#-前置要求)
- [🏁 快速开始](#-快速开始)
- [🐛 Windows 启动故障排查](#-windows-启动故障排查)
- [🌐 抓取与 GitHub API](#-抓取与-github-api)
- [🗂 项目结构](#-项目结构)
- [🔬 测试](#-测试)
- [💾 打包](#-打包)
- [📚 领域词汇](#-领域词汇)
- [📑 文档与工具](#-文档与工具)
- [🗺 路线图与非目标](#-路线图与非目标)

---

# 📖 这是什么

用户关注着一批 GitHub 开源仓库，想知道它们出了新版本没有、最近在改什么、议题多不多、构建还健康吗。现状只能挨个打开 GitHub 人肉翻，既看不出"哪几个仓库有更新"，也回看不到指标随时间的变化。

本项目把这件事收进一个桌面 App：**监控清单 → 轻量信息 → 全量信息 → 按日历史快照 → 趋势**。

# 📦 安装

⚠️ **目前还没有正式发布的安装包**（仓库里 `release/` 尚未生成），所以现阶段只有一条实际路径：自己构建。构建需要先按 [开发](#-开发) 把环境装好，然后：

```bash
npm install
npm run dist
```

产物是 Windows 安装器，位于 `release/`。特点：**非一键安装**（会走安装向导）、**可自选安装目录**。安装后双击启动即可——Electron 运行时已打包进安装器，**不需要另装 Node.js**。

# 🔑 首次启动：配置访问令牌

**访问令牌（PAT）是必填的**：应用靠它调 GitHub API（未认证的配额很低），未配置时界面会强制停留在设置页。

1. 到 [GitHub Settings → Tokens](https://github.com/settings/tokens) 生成一个个人访问令牌（读取公开仓库数据即可）。
2. 粘贴进设置页的输入框，点「保存并验证」。
3. 保存前会调用 `GET /user` 验证，**验证通过才落库**；失败会给出明确提示。

令牌用操作系统钥匙串（Electron `safeStorage`）加密后存本机，明文不落库、不写日志。

# 📋 日常使用

## 🎯 监控清单（轻量信息）

- 输入 `owner/repo`、GitHub 网址或 `git@github.com:owner/name` 均可加入。**加入前会先真实抓取验证**，不存在或无权访问的仓库不会入列。
- 重复添加会被拒收（大小写不敏感）。
- 每行显示三条**轻量信息**：⭐ star 数、🕒 最近动态时间（7 天内高亮）、🏷 最新发版标签（没有就显示"无发版"）。
- 启动时自动抓取一次；之后用「重新抓取」手动刷新。
- **数据在 60 秒内视为新鲜**：窗口切回前台、在清单与详情之间来回切换都**不会**自动重抓（避免白耗配额、也避免同一天快照被反复覆盖）。需要新数据时点「重新抓取」。
- 删除是两步确认（再点一次），4 秒不操作会自动取消。

## 📊 全量信息（五类更新）

点开清单里任意一行，按类别分区展示：

| 类别 | 展示内容 |
|---|---|
| 🏷 发版 | 标签、标题、发布日期 |
| 📝 提交 | SHA、消息、作者、时间 |
| 💬 议题与合并请求 | 分为「议题」「合并请求」两个子区，各含状态（开启 / 已关闭）、作者、更新时间 |
| 🏗 构建状态 | 状态徽章（构建通过 / 构建失败 / 构建中 / 无结论 / 无构建）、工作流名、完成时间 |
| 📈 星标趋势 | star 与 fork 双折线 |

## 📈 历史快照与趋势

- **只有抓取成功才记档**；同一仓库同一天只留一档，当天重复抓取会覆盖为最新值。
- 没有的值（比如无发版）记空；抓取失败不记档。
- 趋势图是某仓库历史快照里 star / fork 的变化，**至少要有 2 个点才出图**——所以刚装上是空的，用几天才会长出曲线。

# 💥 出错时会怎样

应用**不会因为抓取失败清空界面**，一律是「保留上次数据 + 顶部错误条」。错误被归成五类：

| 情况 | 你会看到 |
|---|---|
| 🔑 令牌失效 | 提示更换令牌，并给出「去设置」按钮 |
| ⏳ 被限流 | 提示等待恢复，并显示预计恢复时间 |
| 🚫 仓库不存在 / 无权访问 | 明确提示，且不会把坏条目留在清单里 |
| 📡 网络失败 / 请求超时 | 提示检查网络后重试 |
| ❓ 其他 | 通用失败提示 |

另外，令牌失效或限流会**中止整批抓取**，不会对后面每个仓库重复报同一个错；其他仓库的失败则逐条标注仓库名。

应用**启动失败**（如数据库文件损坏、数据目录不可写）会弹出系统错误框并指明日志目录，不会静默退出。

# 🔒 数据与隐私

- 所有数据只在本机，**不上传任何服务器**；断网也能翻看已有内容。
- 数据库：`<userData>/octo.db`（Electron 的应用数据目录，Windows 下位于 `%APPDATA%` 内；SQLite）。
- 日志：`<userData>/logs/octo.log`（追加写入，写日志失败被静默吞掉，不影响业务）。
- 访问令牌：存数据库 `setting` 表的 `access_token` 键，值为加密密文（`ss:` 前缀 + base64）。若系统安全存储不可用，**保存会直接失败并报明原因，绝不降级为明文**。
- 各人各自安装、各用自己的令牌与清单，互不干扰。

# 🖥 窗口与后台行为

- 普通窗口，**无托盘、无开机自启**。
- 关闭即停，**不留后台进程**。
- **没有后台定时任务**：快照的"每天一档"由你触发的抓取产生，不会在后台悄悄跑。

---

# 🔧 开发

## 🎛 技术栈

| 层 | 选型 |
|---|---|
| 🖥 桌面壳 | Electron 44（主进程 CJS + preload 沙箱 + contextIsolation） |
| ⚙ 主进程 | TypeScript、better-sqlite3（本地 SQLite） |
| 🎨 渲染进程 | React 18、Vite 8、Tailwind CSS 3、TanStack Query v5、Chart.js 4 |
| 🔬 测试 | Vitest 5（node 环境、threads） |
| 📦 打包 | electron-builder → Windows NSIS（x64） |

## 🏗 架构

**主进程三层 + 唯一门面**，渲染进程只做 UI，全部数据经 preload 白名单 IPC 进出：

```
渲染进程 (React)
   │  window.octo.*  ← 10 个白名单 IPC 通道 (octo:xxx)
preload (contextBridge)
   │
facade  ← 用例边界，渲染层唯一入口；错误在此归一
   │
features  ← 用例片段 + 全部 SQL：watchlist / fetching / snapshots / settings / repo-input
   │
core      ← 基础设施：db / github(REST 适配器) / cipher / clock / logger
```

要点：

- **依赖方向单向**：`core` 不依赖 `features`，`features` 之间不互相引用，`facade` 是唯一用例边界（测试也只测这个边界）。
- **契约在 `src/shared/`**：`types.ts` 定义领域类型与 `OctoFacade`，`ipc.ts` 定义通道常量；preload 内联通道字面量并用字面量类型锁定，与主进程漂移即编译报错。
- **全依赖注入**：`createFacade({ db, github, cipher, clock, logger })`——GitHub 适配器、加密盒、时钟、日志都可替换，这也是测试得以完全离线的原因。
- **无推送**：全部为 `ipcMain.handle` 请求/响应，没有 `webContents.send` 主动推送。
- **时间统一 UTC ISO8601 存储**，展示层转相对时间；`snapshot.day` 用本地日期做去重键。
- **全量数据不落库**：只有轻量展示字段与每日快照持久化。

## 📌 前置要求

- **Node.js 22.12+ 或 24.x**（由 electron 44 的 `>=22.12`、better-sqlite3 13 的 `>=22`、vitest 5 的 `^22.12 || ^24 || >=26` 共同约束）与 npm
- Windows（打包目标为 NSIS x64）；开发启动在 macOS / Linux 上亦可（better-sqlite3 提供各平台预编译二进制）

## 🏁 快速开始

```bash
npm install        # 安装依赖（含 Electron 二进制，首次约 100MB；网络受限时需自备代理）

npm start          # 构建主进程 + 渲染进程，然后启动 Electron
npm run typecheck  # 全量类型检查
npm test           # 构建主进程后跑 Vitest
npm run dist       # 打包 Windows NSIS 安装包到 release/
```

开发时也可单独执行 `npm run build:main` / `npm run build:renderer`。

`dist/` 不入库，而 `package.json` 的 `main` 指向 `dist/main/main/index.js`——所以全新克隆后必须先构建才能 `electron .`（`npm start` 已包含这一步）。依赖装好后没有 `postinstall` 步骤，better-sqlite3 直接用包内自带的预编译二进制，**无需** Visual Studio / node-gyp 工具链。

**提示**：仓库没有配 `dev` 脚本。主进程支持开发模式（读 `process.env.VITE_DEV_SERVER_URL`，Vite dev 端口固定 5173），但没有脚本去拉起它，所以日常开发就是走 `npm start` 的全量构建。

## 🐛 Windows 启动故障排查

**启动即崩、无输出退出（0x80000003）** —— 病因是 Electron 目录的完整性标签被降为 `Low`。确认：

```bash
icacls node_modules\electron\dist        # 显示 Low 即确诊
```

修复：

```bash
icacls node_modules\electron\dist /setintegritylevel "(OI)(CI)Medium" /T /C
```

完成判据：`node_modules\electron\dist\electron.exe --version` 能打印版本号。重装 Electron 或环境重写标签后可能复发，重跑同一条命令即可。Chromium 沙箱保持开启，**不要**用 `--no-sandbox` 绕过。

另外，**agent 执行沙箱内 Electron GUI 起不来**（`app.whenReady()` 不触发、GUI 输出捕获不可靠）属环境限制而非应用故障，启动验证要在普通终端里跑。

## 🌐 抓取与 GitHub API

所有请求打向 `https://api.github.com`，统一带请求头：`Authorization: Bearer <PAT>`、`Accept: application/vnd.github+json`、`X-GitHub-Api-Version: 2022-11-28`、`User-Agent: octo-monitor`。

| 场景 | 端点 | 调用次数 |
|---|---|---|
| 🔑 令牌校验 | `GET /user` | 1 |
| 🎯 轻量信息 | `GET /repos/{full_name}` + `GET /repos/{full_name}/releases/latest` | 每仓库 2 次 |
| 🏷 发版 | `GET /repos/{full_name}/releases?per_page=30` | 1 |
| 📝 提交 | `GET /repos/{full_name}/commits?per_page=30` | 1 |
| 💬 议题与合并请求 | `GET /repos/{full_name}/issues?state=all&per_page=50` | 1（同一端点返回，按 `pull_request` 标记拆成两区） |
| 🏗 构建状态 | `GET /repos/{full_name}/actions/runs?per_page=1` | 1 |
| 📈 星标趋势 | **不调接口** | 0（读本机历史快照） |

要点：

- **全量抓取 = 每仓库 4 次调用**（发版 + 提交 + 议题与 PR + 构建）。清单页的「重新抓取」只走轻量（2 次），详情页的「重新抓取」才走全量。
- `/releases/latest` 的 **404 被吞掉、视为「无发版」**，不算错误。
- **限流不做主动探测**，只在出错时反应式判定：`429`，或 `403` 且 `x-ratelimit-remaining: 0`，或响应带 `retry-after`；恢复时间优先取 `x-ratelimit-reset`（epoch 秒）。
- 清单批量抓取**并发 5**（`GLANCE_CONCURRENCY`）；令牌失效 / 限流会**中止后续波次**且同类错误只上报一次。
- **单次请求 10 秒超时**（`AbortSignal.timeout`），超时按「网络失败」上报，不会让界面无限期停在「抓取中」。
- **没有任何自动重试或退避**——失败后由用户再次点击刷新。也没有 ETag / 条件请求与翻页游标。
- 构建结论归一：`null` → `none`（无构建）、`conclusion` 未出 → `pending`、`success` → `success`、`failure` / `timed_out` / `action_required` / `startup_failure` → `failure`、其余 → `neutral`。

## 🗂 项目结构

```
src/
├─ main/
│  ├─ index.ts            组合根：logger → db → facade → ipc → window
│  ├─ ipc.ts              10 个白名单通道注册
│  ├─ facade/             用例门面 + 错误归一
│  ├─ features/           watchlist / fetching / snapshots / settings / repo-input
│  └─ core/               db / github(port + http 适配器) / cipher / clock / logging
├─ preload/index.ts       contextBridge 暴露 window.octo
├─ renderer/              React UI：App + pages/ + components/ + lib/
└─ shared/                跨进程契约：types.ts + ipc.ts

tests/                    Vitest 集成测试（含 helpers/ 与 manual-acceptance/）
docs/adr/                 架构决策记录
docs/agents/              仓库工程约定（domain / issue-tracker / triage-labels）
.agents/                  第三方 Agent 技能集（本机保留，不入库）
.scratch/                 本地 issue tracker 与 v1 spec（本机保留，不入库）
tools/compat/             沙箱兼容垫片
```

## 🔬 测试

```bash
npm test   # = build:main + vitest run
```

**策略：以门面集成测试为主，另有两个适配器的窄缝直测**（`core/db` 的建表与迁移、`core/github/http-github` 的请求层）以及 preload 构建产物。门面用例只断言返回值与数据库落档，不测内部调用顺序、私有状态与 UI 结构。

| 组件 | 真/假 |
|---|---|
| SQLite | ✅ **真**（`os.tmpdir()` 下的临时文件库，顺带验证建表与迁移） |
| 用例门面 `OctoFacade` | ✅ **真**（被测对象） |
| GitHub 网络层 | 🎭 假（录制 fixtures，含限流 / 401 / 404 / 网络 / 未知错误） |
| 加密盒、时钟 | 🎭 假（可逆 base64；时钟默认本地正午，保证跨时区稳定）。令牌保存用例另注入**真实加密盒**，覆盖系统安全存储不可用 |

覆盖：数据库建表与升级迁移、令牌校验保存（含系统安全存储不可用）、清单增删与输入归一、轻量抓取、全量五类与构建结论归一、快照日档去重、错误归一与降级、请求超时。

另有一个特殊回归测试 `tests/preload/preload-sandbox.test.ts`：直接执行编译产物 `dist/main/preload/index.js`，用沙箱 `require` 白名单（`electron/events/timers/url`）复现 Electron ≥20 的限制，断言通道名与 `src/shared/ipc.ts` 逐字一致。

**UI 不写单测**，由 [`tests/manual-acceptance/`](tests/manual-acceptance/README.md) 的人工验收矩阵覆盖。

## 💾 打包

```bash
npm run dist   # = build + electron-builder --win nsis
```

配置见 `electron-builder.yml`：

- `appId: com.octo.monitor`，`productName: OCTO 仓库监控器`
- 目标：Windows **NSIS x64**，输出到 `release/`
- `oneClick: false` + `allowToChangeInstallationDirectory: true` → 走安装向导、可自选安装目录
- 打包内容仅 `dist/**` + `package.json`

## 📚 领域词汇

全项目（代码、测试、文档、提交信息）统一使用 [`CONTEXT.md`](CONTEXT.md) 的词汇表，不漂移到同义词：

**监控清单（watchlist）** · **监控仓库（repository）** · **更新（update）** · **更新类别（category）** · **轻量信息（glance）** · **全量信息（detail）** · **最近动态时间（last activity）** · **历史快照（snapshot）** · **趋势（trend）** · **访问令牌（PAT）** · **抓取（fetch）**

## 📑 文档与工具

- [`CONTEXT.md`](CONTEXT.md) —— 领域词汇表（含每条的 Avoid 词）。
- [`docs/adr/`](docs/adr/) —— 架构决策记录。ADR-0001 记录**双栈决策**：v1 Windows 用 Electron，v1.1 Android 用 Kotlin + Jetpack Compose，两端业务逻辑各写一遍、以 v1 spec 对齐（**Kotlin 端目前仅为规划，尚未实现**）。
- [`docs/agents/`](docs/agents/) —— 仓库工程约定：issue tracker（本地 Markdown）、triage 标签、领域文档规则。
- `.agents/`（第三方 Agent 技能集）、`skills-lock.json`（其锁文件）与 `.scratch/`（本地 issue tracker 与 v1 spec）—— **仅本机保留，不入库**。
- `tools/compat/no-pipe-spawn.cjs` —— 沙箱兼容垫片。受限环境中带管道 stdio 的子进程 `spawn` 会同步抛 `EPERM`，而 Vite 在 Windows 解析真实路径时会异步执行 `net use` 探测网络盘，本应静默跳过却会炸掉模块解析。该垫片包装 `child_process` 的捕获式 API，把同步抛错降级为"探测失败"，仅通过 `node --require` 注入 `test` / `test:watch` / `build:renderer` 三个脚本。
- 根目录 `github_pulse_repository_monitor.html` 与 `octo_nexus_github_personal_center.html` 是**早期 UI 原型**（单文件 HTML + CDN，只有界面没有数据链路），其可用 UI 资产被 v1 复用；这两个文件**不入库**，仅本机保留。

## 🗺 路线图与非目标

**路线图**

- **M1** 地基：骨架 + core + 令牌连通
- **M2** 核心链路端到端
- **M3** = v1：打包与人工验收——清单持久化、三条轻量信息、五类全量、快照当日不重复、错误降级不崩溃、5 仓库冷启动就绪 ≤ 8 秒、NSIS 独立安装。人工验收矩阵已就位（[`tests/manual-acceptance/`](tests/manual-acceptance/README.md)）；安装包尚未生成（`release/` 未创建）
- **M4** = v1.1：Android 端（Kotlin + Jetpack Compose），另立 spec，按 v1 的数据结构与规则对齐

**非目标**

通知渠道；共享 / 多用户；事件流与已读状态；云同步或真服务端；监控模式（Watching / Starred 区分）；导出备份；以及原型中的 CI 流水线阶段动画、双轴大图表、Webhook 终端、AI 哨兵、模拟数据源与演示令牌、限流遥测仪表、告警铃铛。

---

## 📜 许可

私有项目（`private: true`，UNLICENSED）。
