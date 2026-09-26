import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';
import type { OctoFacade } from '../shared/types';

/**
 * 白名单 IPC：渲染层只能调用用例门面的固定方法，
 * 通道与 preload 端一一对应（见 src/shared/ipc.ts）。
 */
export function registerIpc(facade: OctoFacade): void {
  ipcMain.handle(IPC_CHANNELS.tokenState, () => facade.tokenState());
  ipcMain.handle(IPC_CHANNELS.validateToken, (_event, token: string) => facade.validateToken(token));
  ipcMain.handle(IPC_CHANNELS.saveToken, (_event, token: string) => facade.saveToken(token));
  ipcMain.handle(IPC_CHANNELS.clearToken, () => facade.clearToken());
  ipcMain.handle(IPC_CHANNELS.getSettings, () => facade.getSettings());
  ipcMain.handle(IPC_CHANNELS.updateSettings, (_event, patch: Record<string, string>) =>
    facade.updateSettings(patch),
  );
  ipcMain.handle(IPC_CHANNELS.listRepositories, () => facade.listRepositories());
  ipcMain.handle(IPC_CHANNELS.addRepository, (_event, fullName: string) => facade.addRepository(fullName));
  ipcMain.handle(IPC_CHANNELS.removeRepository, (_event, repositoryId: number) =>
    facade.removeRepository(repositoryId),
  );
  ipcMain.handle(IPC_CHANNELS.refreshGlance, () => facade.refreshGlance());
  ipcMain.handle(IPC_CHANNELS.fetchDetail, (_event, repositoryId: number) => facade.fetchDetail(repositoryId));
}
