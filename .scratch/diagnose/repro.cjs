/**
 * 复现回路：启动真实 Electron 应用（npm start 的 `electron .` 部分），
 * 经 CDP 断言用户的确切症状：
 *   红灯 = 页面出现"无法读取访问令牌状态"错误条，或 window.octo.accessTokenState() 不可用/拒绝。
 * 绿灯 = accessTokenState() 正常返回且设置页可输入令牌。
 * 用法：node .scratch/diagnose/repro.cjs   （退出码 0=绿，1=红，2=回路自身故障）
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 9223;
const SYMPTOM_TEXT = '无法读取访问令牌状态';
const TIMEOUT_MS = 30000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('timeout')));
  });
}

async function waitForPageTarget() {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${PORT}/json/list`);
      const page = targets.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page;
    } catch {
      /* 主进程还在启动 */
    }
    await sleep(250);
  }
  throw new Error('回路故障：超时未出现 CDP page target');
}

function connectCdp(webSocketDebuggerUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(webSocketDebuggerUrl, { headers: { Origin: 'http://localhost' } });
    let nextId = 1;
    const pending = new Map();
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: res, reject: rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
      }
    };
    ws.onopen = () =>
      resolve({
        send(method, params = {}) {
          return new Promise((res, rej) => {
            const id = nextId++;
            pending.set(id, { resolve: res, reject: rej });
            ws.send(JSON.stringify({ id, method, params }));
          });
        },
        close: () => ws.close(),
      });
    ws.onerror = (event) => reject(new Error('WebSocket 错误: ' + (event.message || 'unknown')));
    setTimeout(() => reject(new Error('回路故障：CDP WebSocket 超时')), 5000);
  });
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    return { threw: true, text: result.exceptionDetails.exception?.description ?? JSON.stringify(result.exceptionDetails) };
  }
  return { threw: false, value: result.result.value };
}

async function main() {
  const electronPath = require(path.join(ROOT, 'node_modules', 'electron'));
  const outLog = path.join(__dirname, 'app-stdout.log');
  const errLog = path.join(__dirname, 'app-stderr.log');
  const outFd = fs.openSync(outLog, 'w');
  const errFd = fs.openSync(errLog, 'w');

  // stdio 用文件句柄而非管道：受限沙箱禁止管道 spawn
  // 与用户 `npm start`（electron .）一致的启动方式，只额外开 CDP 调试端口。
  // 注意：不得加 --no-sandbox（已否决的绕过方案，见 AGENTS.md）。
  const child = spawn(
    electronPath,
    ['.', `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*'],
    {
    cwd: ROOT,
    stdio: ['ignore', outFd, errFd],
    detached: false,
  });
  let childExited = false;
  child.on('exit', (code) => {
    childExited = true;
    console.log(`[repro] electron 退出，code=${code}`);
  });

  try {
    const target = await waitForPageTarget();
    const cdp = await connectCdp(target.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');

    // 等 React 渲染出错误条或设置页表单
    const deadline = Date.now() + TIMEOUT_MS;
    let snapshot = null;
    while (Date.now() < deadline) {
      snapshot = await evaluate(
        cdp,
        `(() => {
          const body = document.body ? document.body.innerText : '';
          return {
            hasSymptom: body.includes(${JSON.stringify(SYMPTOM_TEXT)}),
            hasTokenInput: !!document.querySelector('input[type=password], input[type=text]'),
            bodyText: body.slice(0, 400),
            octoType: typeof window.octo,
          };
        })()`,
      );
      if (snapshot.value && (snapshot.value.hasSymptom || snapshot.value.hasTokenInput)) break;
      if (childExited) break;
      await sleep(400);
    }

    // 直接经 preload 桥调用用例门面，拿到真实拒绝原因
    const bridgeCall = await evaluate(
      cdp,
      `(() => {
        if (typeof window.octo === 'undefined') return { outcome: 'no-bridge' };
        if (typeof window.octo.accessTokenState !== 'function') return { outcome: 'no-method' };
        return window.octo.accessTokenState().then(
          (value) => ({ outcome: 'ok', value }),
          (error) => ({ outcome: 'rejected', message: String(error && error.message || error) })
        );
      })()`,
    );

    cdp.close();

    const s = snapshot && snapshot.value ? snapshot.value : { hasSymptom: false, hasTokenInput: false, octoType: 'unknown', bodyText: '' };
    console.log('--- 诊断快照（已脱敏：仅输出页面文字与结构）---');
    console.log('window.octo 类型      :', s.octoType);
    console.log('页面出现症状错误条    :', s.hasSymptom);
    console.log('页面有可输入令牌表单  :', s.hasTokenInput);
    console.log('accessTokenState()    :', JSON.stringify(bridgeCall));
    console.log('页面文字片段          :', JSON.stringify(s.bodyText));

    const red =
      s.hasSymptom ||
      !s.hasTokenInput ||
      bridgeCall.threw ||
      (bridgeCall.value && bridgeCall.value.outcome !== 'ok');
    console.log(red ? 'VERDICT: RED（复现用户症状）' : 'VERDICT: GREEN（症状消失）');
    process.exitCode = red ? 1 : 0;
  } catch (error) {
    console.log('回路故障：', String(error));
    process.exitCode = 2;
  } finally {
    if (!childExited) {
      try {
        child.kill();
      } catch {
        /* 已退出 */
      }
    }
    fs.closeSync(outFd);
    fs.closeSync(errFd);
    try {
      const errText = fs.readFileSync(errLog, 'utf8').trim();
      if (errText) console.log('--- electron stderr ---\n' + errText.slice(0, 3000));
    } catch {
      /* 无输出 */
    }
  }
}

main();
