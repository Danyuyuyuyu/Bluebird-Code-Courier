/** IPC 通道白名单：preload 与主进程共同引用，渲染层只能经此访问用例门面。 */
export const IPC_CHANNELS = {
  accessTokenState: 'octo:accessTokenState',
  validateAccessToken: 'octo:validateAccessToken',
  saveAccessToken: 'octo:saveAccessToken',
  getSettings: 'octo:getSettings',
  updateSettings: 'octo:updateSettings',
  listRepositories: 'octo:listRepositories',
  addRepository: 'octo:addRepository',
  removeRepository: 'octo:removeRepository',
  refreshGlance: 'octo:refreshGlance',
  fetchDetail: 'octo:fetchDetail',
} as const;

export type IpcChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
