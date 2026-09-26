import { app, BrowserWindow, safeStorage } from 'electron';
import path from 'node:path';
import { openDatabase } from './core/db/database';
import { createSafeStorageCipherBox } from './core/cipher/cipher-box';
import { createFileLogger } from './core/logging/logger';
import { systemClock } from './core/clock';
import { createHttpGitHub } from './core/github/http-github';
import { createFacade } from './facade/facade';
import { registerIpc } from './ipc';

/**
 * Electron 主进程：承载服务层（core + features），经白名单 IPC 暴露用例门面。
 * 普通窗口、无托盘、无开机自启；关闭即停，不留后台进程；数据全部在本机。
 */
function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 480,
    minHeight: 640,
    autoHideMenuBar: true,
    title: 'OCTO 仓库监控器',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }
  return window;
}

void app.whenReady().then(() => {
  const userData = app.getPath('userData');
  const logger = createFileLogger(path.join(userData, 'logs'));
  logger.info('主进程启动');
  const db = openDatabase(path.join(userData, 'octo.db'));
  const facade = createFacade({
    db,
    github: createHttpGitHub(),
    cipher: createSafeStorageCipherBox(safeStorage),
    clock: systemClock,
    logger,
  });
  registerIpc(facade);
  createWindow();
  logger.info('窗口已创建');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
