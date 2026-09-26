## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Electron 启动（Windows 本机）

- **启动即崩、无输出退出（0x80000003）** → 病因是应用目录的完整性标签：`icacls node_modules\electron\dist` 显示 `Low` 即确认。修复一条命令：`icacls node_modules\electron\dist /setintegritylevel "(OI)(CI)Medium" /T /C`。完成判据：`node_modules\electron\dist\electron.exe --version` 打印版本号。重装 electron 或环境重写标签后复发，重跑同一条命令。
- **agent 执行沙箱内 Electron GUI 起不来**（`app.whenReady()` 不触发、GUI 程序输出捕获不可靠）→ 这是环境限制、非应用故障；启动验证一律由用户在自己的终端执行 `npm start`。
- Chromium 沙箱保持开启：崩溃修复走上面的标签命令，`--no-sandbox` 是已否决的绕过方案。
