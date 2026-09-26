import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { Glance } from '../../shared/types';
import { formatRelativeTime, isWithinDays } from '../lib/time';
import { GlanceFact } from './GlanceFact';

interface RepoRowProps {
  repo: Glance;
  onOpen: (repo: Glance) => void;
  onRemove: (repositoryId: number) => Promise<void> | void;
  removing: boolean;
}

/** 监控清单里的一行监控仓库（轻量信息 + 两步确认删除）。 */
export function RepoRow({ repo, onOpen, onRemove, removing }: RepoRowProps) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  function handleRemoveClick(event: ReactMouseEvent): void {
    event.stopPropagation();
    if (removing) return;
    if (!confirming) {
      setConfirming(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setConfirming(false), 4000);
      return;
    }
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setConfirming(false);
    void onRemove(repo.id);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(repo)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(repo);
        }
      }}
      className="flex cursor-pointer flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 transition-colors hover:border-emerald-500/40 hover:bg-slate-800/60"
    >
      <div className="min-w-0 flex-1 basis-52">
        <div className="truncate font-mono text-sm font-medium text-slate-100">{repo.fullName}</div>
        <div className="mt-1 text-xs text-slate-500">
          抓取于 {repo.fetchedAt ? formatRelativeTime(repo.fetchedAt) : '尚未抓取'}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <GlanceFact label="star 数" value={repo.stars === null ? '—' : String(repo.stars)} mono />
        <GlanceFact
          label="最近动态时间"
          value={repo.pushedAt ? formatRelativeTime(repo.pushedAt) : '—'}
          accent={isWithinDays(repo.pushedAt, 7)}
        />
        <GlanceFact
          label="最新发版标签"
          value={repo.latestReleaseTag ?? '无发版'}
          mono
          muted={repo.latestReleaseTag === null}
        />
      </div>

      <button
        type="button"
        onClick={handleRemoveClick}
        disabled={removing}
        className={`shrink-0 rounded border px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          confirming
            ? 'border-red-400/60 bg-red-500/20 text-red-200 hover:bg-red-500/30'
            : 'border-red-500/30 text-red-300 hover:bg-red-500/15 active:bg-red-500/25'
        }`}
      >
        {removing ? '删除中…' : confirming ? '确认删除？' : '删除'}
      </button>
    </div>
  );
}
