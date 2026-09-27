import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';
import type { OctoFacade } from '../shared/types';
import { applyThemeSource } from './theme';

/**
 * 白名单 IPC：渲染层只能调用用例门面的固定方法，
 * 通道与 preload 端一一对应（见 src/shared/ipc.ts）。
 */
export function registerIpc(facade: OctoFacade): void {
  ipcMain.handle(IPC_CHANNELS.accessTokenState, () => facade.accessTokenState());
  ipcMain.handle(IPC_CHANNELS.validateAccessToken, (_event, accessToken: string) => facade.validateAccessToken(accessToken));
  ipcMain.handle(IPC_CHANNELS.saveAccessToken, (_event, accessToken: string) => facade.saveAccessToken(accessToken));
  ipcMain.handle(IPC_CHANNELS.getSettings, () => facade.getSettings());
  ipcMain.handle(IPC_CHANNELS.updateSettings, async (_event, patch: Record<string, string>) => {
    const view = await facade.updateSettings(patch);
    // 偏好落库后立刻同步 Electron：强制浅/深色要立刻生效，切回 system 要交还给系统
    applyThemeSource(view.preferences);
    return view;
  });
  ipcMain.handle(IPC_CHANNELS.listRepositories, () => facade.listRepositories());
  ipcMain.handle(IPC_CHANNELS.addRepository, (_event, fullName: string) => facade.addRepository(fullName));
  ipcMain.handle(IPC_CHANNELS.removeRepository, (_event, repositoryId: number) =>
    facade.removeRepository(repositoryId),
  );
  ipcMain.handle(IPC_CHANNELS.refreshGlance, () => facade.refreshGlance());
  ipcMain.handle(IPC_CHANNELS.fetchDetail, (_event, repositoryId: number) => facade.fetchDetail(repositoryId));
}
