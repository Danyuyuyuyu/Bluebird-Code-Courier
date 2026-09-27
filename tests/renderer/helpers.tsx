/** 渲染层交互测试的公共装置：桩 window.octo + react-query 容器 + DOM 查询与事件辅助。 */
import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AddRepositoryResult, AccessTokenResult, Detail, Glance, OctoBridge } from '../../src/shared/types';
import { App } from '../../src/renderer/App';
import { ThemeProvider } from '../../src/renderer/lib/theme';

// react 18.3 的 act 需要这个环境标志，否则会在控制台告警
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ---------- 假系统主题：happy-dom 的 matchMedia 恒为浅色，这里换成可控的 ----------

let systemTheme: 'light' | 'dark' = 'light';
const mediaListeners = new Set<() => void>();

function installMatchMedia(): void {
  const matchMedia = (query: string): MediaQueryList => {
    const list = {
      media: query,
      get matches() {
        return systemTheme === 'dark';
      },
      onchange: null,
      addEventListener: (_type: string, listener: () => void) => {
        mediaListeners.add(listener);
      },
      removeEventListener: (_type: string, listener: () => void) => {
        mediaListeners.delete(listener);
      },
      addListener: (listener: () => void) => {
        mediaListeners.add(listener);
      },
      removeListener: (listener: () => void) => {
        mediaListeners.delete(listener);
      },
      dispatchEvent: () => true,
    };
    return list as unknown as MediaQueryList;
  };
  window.matchMedia = matchMedia as unknown as typeof window.matchMedia;
}

/** 模拟 Windows 切深色 / 浅色：改系统值并通知监听者，等价于 prefers-color-scheme 变化。 */
export function setSystemTheme(theme: 'light' | 'dark'): void {
  systemTheme = theme;
  for (const listener of mediaListeners) listener();
}

export function resetSystemTheme(): void {
  systemTheme = 'light';
  mediaListeners.clear();
}

// ---------- 桩门面 ----------

export interface StubCalls {
  accessTokenState: number;
  saveAccessToken: number;
  validateAccessToken: number;
  getSettings: number;
  updateSettings: number;
  listRepositories: number;
  refreshGlance: number;
  fetchDetail: number;
  addRepository: number;
  removeRepository: number;
}

export interface StubHandle {
  api: OctoBridge;
  calls: StubCalls;
  /** 桩里当前的偏好项（updateSettings 成功后同步）。 */
  readonly preferences: Record<string, string>;
  /** 收到过的 updateSettings 补丁，按顺序。 */
  settingsPatches: Array<Record<string, string>>;
  /** 下次 listRepositories 返回的清单（删除成功后用它模拟清单缩小）。 */
  setRepositories(repositories: Glance[]): void;
  /** 让下一次 listRepositories 挂起，返回放行函数。 */
  holdNextList(): () => void;
  /** 让下一次 refreshGlance 挂起，返回放行函数。 */
  holdNextRefresh(): () => void;
  /** 让下一次 removeRepository 挂起，返回放行函数。 */
  holdNextRemove(): () => void;
}

export interface StubOptions {
  repositories?: Glance[];
  /** 第 N 次调用起 reject（1 起算）；0 = 不失败。 */
  listFailFrom?: number;
  refreshGlanceFails?: boolean;
  removeFails?: boolean;
  addResult?: AddRepositoryResult;
  /** getSettings 初始返回的偏好项（如 { theme: 'light' }）。 */
  preferences?: Record<string, string>;
  /** updateSettings 抛错：用于验证主题保存失败的处理。 */
  settingsSaveFails?: boolean;
  /** saveAccessToken 的返回（默认成功）。 */
  saveTokenResult?: AccessTokenResult;
  /** validateAccessToken 的返回（默认成功）。 */
  validateTokenResult?: AccessTokenResult;
}

export function makeGlance(id: number, fullName: string): Glance {
  const [owner = '', name = ''] = fullName.split('/');
  return {
    id,
    owner,
    name,
    fullName,
    addedAt: '2026-09-20T00:00:00.000Z',
    stars: 1000 + id,
    forks: 100 + id,
    openIssues: 12,
    pushedAt: '2026-09-26T00:00:00.000Z',
    latestReleaseTag: `v1.0.${id}`,
    fetchedAt: '2026-09-27T00:00:00.000Z',
  };
}

function makeDetail(repository: Glance): Detail {
  return {
    repository,
    releases: [],
    commits: [],
    issues: [],
    pullRequests: [],
    build: { status: 'none', conclusion: null, workflowName: null, url: null, finishedAt: null },
    // 空趋势：概览只渲染「随使用积累」提示，不拉 chart.js 画布
    trend: [],
  };
}

export function createStub(options: StubOptions = {}): StubHandle {
  let repositories = options.repositories ?? [makeGlance(1, 'octocat/Hello-World')];
  let preferences: Record<string, string> = { ...options.preferences };
  const settingsPatches: Array<Record<string, string>> = [];
  let listGate: Promise<void> | null = null;
  let gate: Promise<void> | null = null;
  let removeGate: Promise<void> | null = null;
  const calls: StubCalls = {
    accessTokenState: 0,
    saveAccessToken: 0,
    validateAccessToken: 0,
    getSettings: 0,
    updateSettings: 0,
    listRepositories: 0,
    refreshGlance: 0,
    fetchDetail: 0,
    addRepository: 0,
    removeRepository: 0,
  };

  const api: OctoBridge = {
    async accessTokenState() {
      calls.accessTokenState += 1;
      return { configured: true };
    },
    async validateAccessToken() {
      calls.validateAccessToken += 1;
      return options.validateTokenResult ?? { ok: true, error: null };
    },
    async saveAccessToken() {
      calls.saveAccessToken += 1;
      return options.saveTokenResult ?? { ok: true, error: null };
    },
    async getSettings() {
      calls.getSettings += 1;
      return { preferences: { ...preferences }, accessTokenConfigured: true };
    },
    async updateSettings(patch) {
      calls.updateSettings += 1;
      settingsPatches.push({ ...patch });
      if (options.settingsSaveFails) throw new Error('stub: updateSettings 失败');
      preferences = { ...preferences, ...patch };
      return { preferences: { ...preferences }, accessTokenConfigured: true };
    },
    async listRepositories() {
      calls.listRepositories += 1;
      if (listGate) await listGate;
      if (options.listFailFrom && calls.listRepositories >= options.listFailFrom) {
        throw new Error('stub: listRepositories 失败');
      }
      return repositories;
    },
    async addRepository() {
      calls.addRepository += 1;
      const result: AddRepositoryResult = options.addResult ?? {
        ok: true,
        repository: repositories[0] ?? null,
        error: null,
      };
      return result;
    },
    async removeRepository() {
      calls.removeRepository += 1;
      if (removeGate) await removeGate;
      if (options.removeFails) throw new Error('stub: removeRepository 失败');
    },
    async refreshGlance() {
      calls.refreshGlance += 1;
      if (gate) await gate;
      if (options.refreshGlanceFails) throw new Error('stub: refreshGlance 失败');
      return { repositories, errors: [] };
    },
    async fetchDetail(repositoryId) {
      calls.fetchDetail += 1;
      const repository = repositories.find((item) => item.id === repositoryId);
      if (!repository) return { detail: null, error: null };
      return { detail: makeDetail(repository), error: null };
    },
  };

  return {
    api,
    calls,
    get preferences() {
      return { ...preferences };
    },
    settingsPatches,
    setRepositories(next) {
      repositories = next;
    },
    holdNextList() {
      let release = (): void => {};
      listGate = new Promise<void>((resolve) => {
        release = () => {
          listGate = null;
          resolve();
        };
      });
      return release;
    },
    holdNextRefresh() {
      let release = (): void => {};
      gate = new Promise<void>((resolve) => {
        release = () => {
          gate = null;
          resolve();
        };
      });
      return release;
    },
    holdNextRemove() {
      let release = (): void => {};
      removeGate = new Promise<void>((resolve) => {
        release = () => {
          removeGate = null;
          resolve();
        };
      });
      return release;
    },
  };
}

export interface RenderResult {
  container: HTMLElement;
  unmount: () => Promise<void>;
}

export async function renderApp(stub: StubHandle): Promise<RenderResult> {
  return renderNode(stub, <App />);
}

/** 在同样的 Provider 组合里渲染任意节点（测试自定义探针时用）。 */
export async function renderNode(stub: StubHandle, node: ReactNode): Promise<RenderResult> {
  window.octo = stub.api;
  installMatchMedia();
  const container = document.createElement('div');
  document.body.append(container);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 60_000 } },
  });
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>{node}</ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return {
    container,
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/** 让挂起的 promise 链与渲染跑完；happy-dom 下一条 query 链要跨几轮宏任务才收敛。 */
export async function settle(rounds = 6): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    });
  }
}

export async function click(element: Element | null | undefined): Promise<void> {
  if (!element) throw new Error('要点击的元素不存在');
  await act(async () => {
    (element as HTMLElement).click();
  });
}

export async function pressEscape(): Promise<void> {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
}

export async function pointerDownOutside(element: Element): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  });
}

export async function typeInto(input: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('无法取得 input value setter');
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export async function submitForm(form: HTMLFormElement): Promise<void> {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

/** 主区域（进详情）按钮。 */
export function repoOpenButton(fullName: string): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(`button[aria-label="查看 ${fullName} 详情"]`);
}

/** `···` 操作入口。 */
export function repoActionsButton(fullName: string): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(`button[aria-label="${fullName} 的仓库操作"]`);
}

export function menu(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="menu"]');
}

export function menuItem(text: string): HTMLButtonElement | null {
  return (
    [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((item) =>
      item.textContent?.includes(text),
    ) ?? null
  );
}

export function dialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

export function buttonByText(text: string): HTMLButtonElement | null {
  return (
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === text,
    ) ?? null
  );
}

export function alertTexts(): string[] {
  return [...document.querySelectorAll<HTMLElement>('[role="alert"]')].map(
    (element) => element.textContent ?? '',
  );
}

/** 清单里的仓库卡片（监控清单用 ul/li 承载）。 */
export function repoRows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('main ul > li')];
}

export function bodyText(): string {
  return document.body.textContent ?? '';
}

/** 当前生效主题（由 ThemeProvider 写在 <html> 上）。 */
export function appliedTheme(): string | null {
  return document.documentElement.dataset.theme ?? null;
}

/** 顶部导航按钮（按文案取）。 */
export function navButton(text: string): HTMLButtonElement | null {
  return (
    [...document.querySelectorAll<HTMLButtonElement>('header nav button')].find(
      (button) => button.textContent?.trim() === text,
    ) ?? null
  );
}

/** 分段控件里的按钮（按文案取）。 */
export function segmentedButton(text: string): HTMLButtonElement | null {
  return (
    [...document.querySelectorAll<HTMLButtonElement>('[role="group"] button')].find(
      (button) => button.textContent?.trim() === text,
    ) ?? null
  );
}
