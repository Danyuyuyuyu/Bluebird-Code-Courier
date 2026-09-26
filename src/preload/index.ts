import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';
import type { OctoBridge } from '../shared/types';

/** 白名单网关：仅暴露用例门面的固定方法，不透传任意通道。 */
const bridge: OctoBridge = {
  tokenState: () => ipcRenderer.invoke(IPC_CHANNELS.tokenState),
  validateToken: (token) => ipcRenderer.invoke(IPC_CHANNELS.validateToken, token),
  saveToken: (token) => ipcRenderer.invoke(IPC_CHANNELS.saveToken, token),
  clearToken: () => ipcRenderer.invoke(IPC_CHANNELS.clearToken),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  updateSettings: (patch) => ipcRenderer.invoke(IPC_CHANNELS.updateSettings, patch),
  listRepositories: () => ipcRenderer.invoke(IPC_CHANNELS.listRepositories),
  addRepository: (fullName) => ipcRenderer.invoke(IPC_CHANNELS.addRepository, fullName),
  removeRepository: (repositoryId) => ipcRenderer.invoke(IPC_CHANNELS.removeRepository, repositoryId),
  refreshGlance: () => ipcRenderer.invoke(IPC_CHANNELS.refreshGlance),
  fetchDetail: (repositoryId) => ipcRenderer.invoke(IPC_CHANNELS.fetchDetail, repositoryId),
};

contextBridge.exposeInMainWorld('octo', bridge);
