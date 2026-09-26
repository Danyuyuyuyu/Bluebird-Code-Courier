/**
 * 沙箱兼容垫片：在受限执行环境里，带管道 stdio 的子进程 spawn 会被拒绝（EPERM）。
 * Vite 在 Windows 下解析真实路径时会异步执行 `net use`（stdio 管道）来探测网络盘映射，
 * 该探测失败时本应静默跳过，但 spawn 在本环境是同步抛错，会直接炸掉模块解析。
 *
 * 这里把 child_process 的捕获输出式 API 包一层：捕获式调用一律不真正 spawn，
 * 直接以错误回调返回——调用方（Vite）遇到错误即跳过探测，行为与探测失败一致。
 * 经 `node --require` 注入（见 package.json 的 test/build 脚本），不影响正常开发环境。
 */
const childProcess = require('node:child_process');

function disableCapture(name, fallbackResult) {
  const original = childProcess[name];
  if (typeof original !== 'function') return;
  childProcess[name] = function patched(...args) {
    try {
      return original.apply(this, args);
    } catch (error) {
      const callback = args.find((a) => typeof a === 'function');
      if (callback) process.nextTick(() => callback(error));
      return fallbackResult();
    }
  };
}

disableCapture('exec', () => undefined);
disableCapture('execSync', () => undefined);
disableCapture('execFile', () => undefined);
disableCapture('execFileSync', () => undefined);
disableCapture('spawnSync', () => ({ error: new Error('spawn disabled in sandbox'), status: null, signal: null, stdout: '', stderr: '' }));
