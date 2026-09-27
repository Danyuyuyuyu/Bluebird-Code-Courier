import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Glance, AccessTokenState } from '../shared/types';
import { getApi } from './lib/api';
import { ErrorBar } from './components/ErrorBar';
import { EmptyState } from './components/EmptyState';
import { Spinner } from './components/Spinner';
import { DetailPage } from './pages/DetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { WatchlistPage } from './pages/WatchlistPage';

type View = 'watchlist' | 'detail' | 'settings';

interface SelectedRepo {
  id: number;
  fullName: string;
}

function navButtonClass(active: boolean, disabled: boolean): string {
  const base = 'rounded-md px-3 py-1.5 text-sm transition-colors';
  if (disabled) return `${base} cursor-not-allowed text-slate-600`;
  if (active) return `${base} bg-slate-800 text-emerald-300`;
  return `${base} text-slate-300 hover:bg-slate-800/70 active:bg-slate-800`;
}

export function App() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('watchlist');
  const [selected, setSelected] = useState<SelectedRepo | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 启动即查询访问令牌状态：未配置时先进设置页
  const accessTokenStateQuery = useQuery({
    queryKey: ['accessTokenState'],
    queryFn: () => getApi().accessTokenState(),
  });
  const configured = accessTokenStateQuery.data?.configured ?? false;

  useEffect(() => {
    const state = accessTokenStateQuery.data;
    if (state && !state.configured) setView('settings');
  }, [accessTokenStateQuery.data]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function handleAccessTokenSaved(message?: string): void {
    const next: AccessTokenState = { configured: true };
    queryClient.setQueryData(['accessTokenState'], next);
    void queryClient.invalidateQueries({ queryKey: ['accessTokenState'] });
    setNotice(message ?? '访问令牌已保存并验证通过');
    setView('watchlist');
  }

  function openDetail(repo: Glance): void {
    setSelected({ id: repo.id, fullName: repo.fullName });
    setView('detail');
  }

  const activeView: View = configured ? view : 'settings';
  // 读不到任何状态才整页阻断；已有缓存时后台刷新失败不应把界面清空
  const tokenStateFailed = accessTokenStateQuery.isError;
  const hasTokenState = accessTokenStateQuery.data !== undefined;

  let content;
  if (accessTokenStateQuery.isPending) {
    content = (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-400">
        <Spinner />
        正在启动…
      </div>
    );
  } else if (tokenStateFailed && !hasTokenState) {
    content = (
      <div className="mx-auto max-w-xl space-y-3 py-10">
        <ErrorBar
          error={{ kind: 'unknown', message: '无法读取访问令牌状态，请稍后重试' }}
          action={{ label: '重试', onClick: () => void accessTokenStateQuery.refetch() }}
        />
      </div>
    );
  } else if (activeView === 'settings') {
    // 未配置访问令牌时 activeView 恒为设置页（启动闸门）
    content = <SettingsPage onSaved={handleAccessTokenSaved} onGoWatchlist={() => setView('watchlist')} />;
  } else if (activeView === 'detail') {
    content = selected ? (
      <DetailPage
        repositoryId={selected.id}
        fullName={selected.fullName}
        onBack={() => setView('watchlist')}
        onGoSettings={() => setView('settings')}
      />
    ) : (
      <EmptyState title="先在监控清单中选择一个监控仓库" hint="点击清单中的任意一行即可查看全量信息" />
    );
  } else {
    content = (
      <WatchlistPage onOpenDetail={openDetail} onGoSettings={() => setView('settings')} />
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/15 font-mono text-xs font-bold text-emerald-400">
              OCTO
            </span>
            <h1 className="text-base font-semibold tracking-wide text-slate-100">OCTO 仓库监控器</h1>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setView('watchlist')}
              disabled={!configured}
              className={navButtonClass(activeView === 'watchlist', !configured)}
            >
              监控清单
            </button>
            <button
              type="button"
              onClick={() => setView('detail')}
              disabled={!configured || selected === null}
              title={selected === null ? '先在清单中选择一个监控仓库' : undefined}
              className={navButtonClass(activeView === 'detail', !configured || selected === null)}
            >
              全量信息
            </button>
            <button
              type="button"
              onClick={() => setView('settings')}
              className={navButtonClass(activeView === 'settings', false)}
            >
              设置
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-4 py-5">
        {notice ? (
          <div
            role="status"
            className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
          >
            {notice}
          </div>
        ) : null}
        {tokenStateFailed && hasTokenState ? (
          <div className="mb-4">
            <ErrorBar
              error={{ kind: 'unknown', message: '访问令牌状态刷新失败，正在沿用上次读取的状态' }}
              action={{ label: '重试', onClick: () => void accessTokenStateQuery.refetch() }}
            />
          </div>
        ) : null}
        {content}
      </main>
    </div>
  );
}
