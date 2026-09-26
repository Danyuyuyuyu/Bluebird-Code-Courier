# OCTO 仓库监控器

> 本地优先的 GitHub 仓库监控桌面应用：把关注的仓库放进监控清单，一眼看出"有没有新东西"，并让指标趋势随使用自然积累。

Windows 先行（Electron），数据全部留在本机，打开即用、关闭即停，不留后台进程。

---

## 目录

- [这是什么](#这是什么)
- [核心能力](#核心能力)
- [技术栈](#技术栈)
- [架构](#架构)
- [快速开始](#快速开始)
- [数据与隐私](#数据与隐私)
- [项目结构](#项目结构)
- [测试](#测试)
- [领域词汇](#领域词汇)
- [文档与工具](#文档与工具)
- [路线图](#路线图)
- [非目标](#非目标)

---

## 这是什么

用户关注着一批 GitHub 开源仓库，想知道它们出了新版本没有、最近在改什么、议题多不多、构建还健康吗。现状只能挨个打开 GitHub 人肉翻，既看不出"哪几个仓库有更新"，也回看不到指标随时间的变化。

本项目把这件事收进一个桌面 App：**监控清单 → 轻量信息 → 全量信息 → 按日历史快照 → 趋势**。产品定义见 `.scratch/octo-monitor/spec.md`（仅本机保留，不入库）。

---

## 核心能力

### 监控清单（轻量信息）
- 添加 `owner/repo`、GitHub 网址或 `git@github.com:owner/name` 形式，加入前先真实抓取验证，不存在/无权限的仓库不入列；重复添加（大小写不敏感）会被拒收。
- 每行展示三条**轻量信息**：star 数、最近动态时间（近 7 天高亮）、最新发版标签（无发版显示"无发版"）。
- 启动时自动抓取一次，之后可手动「重新抓取」。
- 删除为两步确认，4 秒无操作自动取消。

### 全量信息（五类更新）
点开任一仓库，按**更新类别**分区展示：

| 类别 | 内容 | 数据来源 |
|---|---|---|
| 发版 | 标签、标题、发布日期 | `GET /repos/{full}/releases` |
| 提交 | SHA、消息、作者、时间 | `GET /repos/{full}/commits` |
| 议题与合并请求 | 分开展示，含状态/作者/更新时间 | `GET /repos/{full}/issues?state=all`（按 `pull_request` 标记拆分） |
| 构建状态 | 状态徽章 + 工作流名 + 完成时间 | `GET /repos/{full}/actions/runs` |
| 星标趋势 | star / fork 双折线 | **不调接口**，读本机历史快照 |

### 历史快照与趋势
- **仅成功抓取后记档**；同一仓库同一（本地）日期只留一档，当日重复抓取覆盖为最新值。
- 缺省值（如无发版）记空；抓取失败不记档。
- 趋势 = 某仓库快照序列的 star / fork 变化，点多于 1 个才出图。

### 访问与降级
- **访问令牌（PAT）必填**，经操作系统钥匙串加密后存本机；只校验保存，明文从不落库、不写日志。
- 错误归一为五类：令牌无效、限流、不存在/无权限、网络失败、未知。
- 一律「**保留上次数据 + 错误条**」，绝不因抓取失败清空界面；限流提示附带恢复时间，令牌失效提供「去设置」入口。
- 未配置令牌时强制停留在设置页。

---

## 技术栈

| 层 | 选型 |
|---|---|
| 桌面壳 | Electron 44（主进程 CJS + preload 沙箱 + contextIsolation） |
| 主进程 | TypeScript、better-sqlite3（本地 SQLite） |
| 渲染进程 | React 18、Vite 8、Tailwind CSS 3、TanStack Query v5、Chart.js 4 |
| 测试 | Vitest 5（node 环境、threads） |
| 打包 | electron-builder → Windows NSIS（x64） |

---

## 架构

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

---

## 快速开始

### 前置
- Node.js（建议 20 以上；开发环境实测 v24.18.0）与 npm
- Windows（打包目标为 NSIS x64）

### 安装与运行

```bash
npm install        # 安装依赖（含 Electron 二进制）

npm start          # 构建主进程 + 渲染进程，然后启动 Electron
npm run typecheck  # 全量类型检查
npm test           # 构建主进程后跑 Vitest
npm run dist       # 打包 Windows NSIS 安装包到 release/
```

开发时也可单独执行 `npm run build:main` / `npm run build:renderer`。

首次启动会被引导到设置页填写[个人访问令牌](https://github.com/settings/tokens)（`ghp_…`），保存前会调用 `GET /user` 验证，验证通过才落库。

### Windows 本机启动故障排查

**启动即崩、无输出退出（0x80000003）** —— 病因是 Electron 目录的完整性标签被降为 `Low`。确认：

```bash
icacls node_modules\electron\dist        # 显示 Low 即确诊
```

修复：

```bash
icacls node_modules\electron\dist /setintegritylevel "(OI)(CI)Medium" /T /C
```

完成判据：`node_modules\electron\dist\electron.exe --version` 能打印版本号。重装 Electron 或环境重写标签后可能复发，重跑同一条命令即可。Chromium 沙箱保持开启，**不要**用 `--no-sandbox` 绕过。

---

## 数据与隐私

- 数据库：`<userData>/octo.db`（SQLite）。
- 日志：`<userData>/logs/octo.log`（追加写入，fs 异常静默吞掉，不影响业务）。
- 访问令牌：`setting` 表中 `access_token` 键，值为 `safeStorage` 加密后的密文（`ss:` 前缀 + base64）。
- 所有数据只在本机，不上传任何服务器；断网也可翻看已有内容。

---

## 项目结构

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

tests/                    Vitest 集成测试（含 helpers/ 与 manual acceptance/）
docs/adr/                 架构决策记录
docs/agents/              仓库工程约定（domain / issue-tracker / triage-labels）
.agents/                  第三方 Agent 技能集（本机保留，不入库）
.scratch/                 本地 issue tracker 与 v1 spec（本机保留，不入库）
tools/compat/             沙箱兼容垫片
```

---

## 测试

```bash
npm test   # = build:main + vitest run
```

**策略：以集成测试为主，测试缝唯一（主进程用例门面）。** 只断言门面返回值与数据库落档，不测内部调用顺序、私有状态与 UI 结构。

| 组件 | 真/假 |
|---|---|
| SQLite | **真**（`os.tmpdir()` 下的临时文件库，顺带验证建表与迁移） |
| 用例门面 `OctoFacade` | **真**（被测对象） |
| GitHub 网络层 | 假（录制 fixtures，含限流 / 401 / 404 / 网络 / 未知错误） |
| 加密盒、时钟 | 假（可逆 base64；时钟默认本地正午，保证跨时区稳定） |

覆盖：数据库建表与升级迁移、令牌校验保存、清单增删与输入归一、轻量抓取、全量五类与构建结论归一、快照日档去重、错误归一与降级。

另有一个特殊回归测试 `tests/preload/preload-sandbox.test.ts`：直接执行编译产物 `dist/main/preload/index.js`，用沙箱 `require` 白名单（`electron/events/timers/url`）复现 Electron ≥20 的限制，断言通道名与 `src/shared/ipc.ts` 逐字一致。

**UI 不写单测**，由 [`tests/manual acceptance/`](tests/manual%20acceptance/README.md) 的人工验收矩阵覆盖。

---

## 领域词汇

全项目（代码、测试、文档、提交信息）统一使用 [`CONTEXT.md`](CONTEXT.md) 的词汇表，不漂移到同义词：

**监控清单（watchlist）** · **监控仓库（repository）** · **更新（update）** · **更新类别（category）** · **轻量信息（glance）** · **全量信息（detail）** · **最近动态时间（last activity）** · **历史快照（snapshot）** · **趋势（trend）** · **访问令牌（PAT）** · **抓取（fetch）**

---

## 文档与工具

- [`CONTEXT.md`](CONTEXT.md) —— 领域词汇表（含每条的 Avoid 词）。
- [`docs/adr/`](docs/adr/) —— 架构决策记录。ADR-0001 记录**双栈决策**：v1 Windows 用 Electron，v1.1 Android 用 Kotlin + Jetpack Compose，两端业务逻辑各写一遍、以 v1 spec 对齐（**Kotlin 端目前仅为规划，尚未实现**）。
- [`docs/agents/`](docs/agents/) —— 仓库工程约定：issue tracker（本地 Markdown）、triage 标签、领域文档规则。
- `.agents/`（第三方 Agent 技能集）与 `.scratch/`（本地 issue tracker 与 v1 spec）—— **仅本机保留，不入库**。
- `tools/compat/no-pipe-spawn.cjs` —— 沙箱兼容垫片。受限环境中带管道 stdio 的子进程 `spawn` 会同步抛 `EPERM`，而 Vite 在 Windows 解析真实路径时会异步执行 `net use` 探测网络盘，本应静默跳过却会炸掉模块解析。该垫片包装 `child_process` 的捕获式 API，把同步抛错降级为"探测失败"，仅通过 `node --require` 注入 `test` / `test:watch` / `build:renderer` 三个脚本。
- 根目录 `github_pulse_repository_monitor.html` 与 `octo_nexus_github_personal_center.html` 是**早期 UI 原型**（单文件 HTML + CDN，只有界面没有数据链路），其可用 UI 资产被 v1 复用；这两个文件**不入库**，仅本机保留。

---

## 路线图

- **M1** 地基：骨架 + core + 令牌连通
- **M2** 核心链路端到端
- **M3** = v1：打包与人工验收——清单持久化、三条轻量信息、五类全量、快照当日不重复、错误降级不崩溃、5 仓库冷启动就绪 ≤ 8 秒、NSIS 独立安装。人工验收矩阵已就位（[`tests/manual acceptance/`](tests/manual%20acceptance/README.md)）；安装包尚未生成（`release/` 未创建）
- **M4** = v1.1：Android 端（Kotlin + Jetpack Compose），另立 spec，按 v1 的数据结构与规则对齐

---

## 非目标

通知渠道；共享 / 多用户；事件流与已读状态；云同步或真服务端；监控模式（Watching / Starred 区分）；导出备份；以及原型中的 CI 流水线阶段动画、双轴大图表、Webhook 终端、AI 哨兵、模拟数据源与演示令牌、限流遥测仪表、告警铃铛。

---

## 许可

私有项目（`private: true`，UNLICENSED）。
