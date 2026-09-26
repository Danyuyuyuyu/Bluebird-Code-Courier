import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Glance, NormalizedError } from '../../shared/types';
import { getApi } from '../lib/api';
import { dedupeErrors } from '../lib/errors';
import { EmptyState } from '../components/EmptyState';
import { ErrorBar } from '../components/ErrorBar';
import { RepoRow } from '../components/RepoRow';
import { Spinner } from '../components/Spinner';

interface WatchlistPageProps {
  onOpenDetail: (repo: Glance) => void;
  onGoSettings: () => void;
}

export function WatchlistPage({ onOpenDetail, onGoSettings }: WatchlistPageProps) {
  const queryClient = useQueryClient();
  const listQuery = useQuery({
    queryKey: ['repositories'],
    queryFn: () => getApi().listRepositories(),
  });

  const [newFullName, setNewFullName] = useState('');
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState<NormalizedError | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshErrors, setRefreshErrors] = useState<NormalizedError[]>([]);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const startedRef = useRef(false);

  // 重新抓取轻量信息；完成后刷新清单查询
  async function runRefresh(): Promise<void> {
    setRefreshing(true);
    try {
      const result = await getApi().refreshGlance();
      setRefreshErrors(dedupeErrors(result.errors));
      await queryClient.invalidateQueries({ queryKey: ['repositories'] });
    } catch {
      setRefreshErrors([{ kind: 'unknown', message: '抓取失败，请稍后重试' }]);
    } finally {
      setRefreshing(false);
    }
  }

  // 启动后自动抓取一次
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd(event: FormEvent): Promise<void> {
    event.preventDefault();
    const fullName = newFullName.trim();
    if (!fullName) return;
    setAdding(true);
    setActionError(null);
    try {
      const result = await getApi().addRepository(fullName);
      if (result.ok) {
        setNewFullName('');
        await queryClient.invalidateQueries({ queryKey: ['repositories'] });
      } else {
        setActionError(result.error ?? { kind: 'unknown', message: '加入清单失败，请稍后重试' });
      }
    } catch {
      setActionError({ kind: 'unknown', message: '加入清单失败，请稍后重试' });
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(repositoryId: number): Promise<void> {
    setRemovingId(repositoryId);
    setActionError(null);
    try {
      await getApi().removeRepository(repositoryId);
      await queryClient.invalidateQueries({ queryKey: ['repositories'] });
    } catch {
      setActionError({ kind: 'unknown', message: '删除失败，请稍后重试' });
    } finally {
      setRemovingId(null);
    }
  }

  const repositories: Glance[] = listQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-100">监控清单</h1>
        <button
          type="button"
          onClick={() => void runRefresh()}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-300 transition-colors hover:bg-emerald-500/20 active:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing ? <Spinner className="h-3.5 w-3.5" /> : null}
          {refreshing ? '抓取中…' : '重新抓取'}
        </button>
      </div>

      <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={newFullName}
          onChange={(event) => setNewFullName(event.target.value)}
          placeholder="owner/repo"
          aria-label="监控仓库（owner/repo）"
          className="w-full min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none sm:max-w-72"
        />
        <button
          type="submit"
          disabled={adding}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 active:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {adding ? '加入中…' : '加入清单'}
        </button>
      </form>

      {actionError ? <ErrorBar error={actionError} onGoSettings={onGoSettings} /> : null}
      {refreshErrors.map((error, index) => (
        <ErrorBar
          key={`${error.kind}|${error.message}|${index}`}
          error={error}
          onGoSettings={onGoSettings}
        />
      ))}
      {listQuery.isError ? (
        <ErrorBar
          error={{ kind: 'unknown', message: '监控清单加载失败，请稍后重试' }}
          onGoSettings={onGoSettings}
          action={{ label: '重试', onClick: () => void listQuery.refetch() }}
        />
      ) : null}

      {listQuery.isPending && !listQuery.data ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-6 py-10 text-sm text-slate-400">
          <Spinner />
          正在加载监控清单…
        </div>
      ) : repositories.length === 0 ? (
        <EmptyState title="还没有监控仓库，输入 owner/repo 开始跟踪" />
      ) : (
        <div className={`space-y-2 transition-opacity ${listQuery.isFetching || refreshing ? 'opacity-60' : ''}`}>
          {repositories.map((repo) => (
            <RepoRow
              key={repo.id}
              repo={repo}
              onOpen={onOpenDetail}
              onRemove={handleRemove}
              removing={removingId === repo.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
