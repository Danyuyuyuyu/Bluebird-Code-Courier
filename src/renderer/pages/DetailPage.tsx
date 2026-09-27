import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  BuildInfo,
  BuildStatus,
  CommitItem,
  Detail,
  DetailResult,
  IssueItem,
  PullRequestItem,
  ReleaseItem,
} from '../../shared/types';
import { getApi } from '../lib/api';
import { formatDate, formatRelativeTime, isWithinDays } from '../lib/time';
import { ErrorBar } from '../components/ErrorBar';
import { GlanceFact } from '../components/GlanceFact';
import { Loading } from '../components/Loading';
import { Section } from '../components/Section';
import { Spinner } from '../components/Spinner';
import { TrendChart } from '../components/TrendChart';

interface DetailPageProps {
  repositoryId: number;
  fullName: string;
  onBack: () => void;
  onGoSettings: () => void;
}

const BUILD_LABELS: Record<BuildStatus, string> = {
  success: '构建通过',
  failure: '构建失败',
  pending: '构建中',
  neutral: '构建无结论',
  none: '无构建',
};

const BUILD_STYLES: Record<BuildStatus, string> = {
  success: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  failure: 'border-red-500/40 bg-red-500/15 text-red-300',
  pending: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  neutral: 'border-slate-600 bg-slate-800 text-slate-300',
  none: 'border-slate-600 bg-slate-800 text-slate-400',
};

const STATE_STYLES = {
  open: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  closed: 'border-slate-600 bg-slate-800 text-slate-400',
} as const;

function StateBadge({ state }: { state: 'open' | 'closed' }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${STATE_STYLES[state]}`}
    >
      {state === 'open' ? '开启' : '已关闭'}
    </span>
  );
}

function ReleaseList({ releases }: { releases: ReleaseItem[] }) {
  if (releases.length === 0) {
    return <p className="text-sm text-slate-500">无发版</p>;
  }
  return (
    <ul className="divide-y divide-slate-800">
      {releases.map((release, index) => (
        <li key={`${release.tagName}|${index}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
          <span className="font-mono text-xs text-emerald-300">{release.tagName}</span>
          <span className="min-w-0 flex-1 text-sm text-slate-200">{release.title}</span>
          <span className="text-xs text-slate-500">{formatDate(release.publishedAt)}</span>
        </li>
      ))}
    </ul>
  );
}

function CommitList({ commits }: { commits: CommitItem[] }) {
  if (commits.length === 0) {
    return <p className="text-sm text-slate-500">无提交</p>;
  }
  return (
    <ul className="divide-y divide-slate-800">
      {commits.map((commit, index) => (
        <li key={`${commit.sha}|${index}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
          <span className="font-mono text-xs text-slate-500">{commit.sha.slice(0, 7)}</span>
          <span className="min-w-0 flex-1 text-sm text-slate-200">{commit.message}</span>
          <span className="text-xs text-slate-400">{commit.authorName ?? '—'}</span>
          <span className="text-xs text-slate-500">{formatRelativeTime(commit.committedAt)}</span>
        </li>
      ))}
    </ul>
  );
}

function NumberedItemRow({
  item,
}: {
  item: IssueItem | PullRequestItem;
}) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
      <span className="font-mono text-xs text-slate-500">#{item.number}</span>
      <span className="min-w-0 flex-1 text-sm text-slate-200">{item.title}</span>
      <StateBadge state={item.state} />
      <span className="text-xs text-slate-400">{item.authorName ?? '—'}</span>
      <span className="text-xs text-slate-500">{formatRelativeTime(item.updatedAt)}</span>
    </li>
  );
}

function IssuesAndPulls({ issues, pullRequests }: { issues: IssueItem[]; pullRequests: PullRequestItem[] }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-1 text-xs font-medium text-slate-400">议题</h3>
        {issues.length === 0 ? (
          <p className="text-sm text-slate-500">无议题</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {issues.map((issue, index) => (
              <NumberedItemRow key={`issue|${issue.number}|${index}`} item={issue} />
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-1 text-xs font-medium text-slate-400">合并请求</h3>
        {pullRequests.length === 0 ? (
          <p className="text-sm text-slate-500">无合并请求</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {pullRequests.map((pull, index) => (
              <NumberedItemRow key={`pr|${pull.number}|${index}`} item={pull} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function BuildFacts({ build }: { build: BuildInfo }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className={`rounded-full border px-2.5 py-0.5 text-xs ${BUILD_STYLES[build.status]}`}>
        {BUILD_LABELS[build.status]}
      </span>
      {build.workflowName ? <GlanceFact label="工作流" value={build.workflowName} mono /> : null}
      {build.finishedAt ? <GlanceFact label="完成于" value={formatRelativeTime(build.finishedAt)} /> : null}
    </div>
  );
}

export function DetailPage({ repositoryId, fullName, onBack, onGoSettings }: DetailPageProps) {
  const detailQuery = useQuery({
    queryKey: ['detail', repositoryId],
    queryFn: async (): Promise<DetailResult> => {
      try {
        return await getApi().fetchDetail(repositoryId);
      } catch {
        return { detail: null, error: { kind: 'unknown', message: '抓取全量信息失败，请稍后重试' } };
      }
    },
    // 详情是全应用唯一会打 GitHub 网络、且带副作用的查询（一次抓取 = 4 次 API 调用 + 写当日快照）。
    // 所以它不进任何自动重取通道：只有首次进入（无缓存）和用户点「重新抓取」才真正请求。
    // gcTime 必须一并放开，否则缓存 5 分钟被回收后再进入会被当成"首次进入"而重抓。
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // 抓取失败时保留上一次成功加载的全量信息（按仓库归属，切换仓库时不串数据）
  const [lastDetail, setLastDetail] = useState<{ id: number; detail: Detail } | null>(null);
  useEffect(() => {
    const detail = detailQuery.data?.detail;
    if (detail) setLastDetail({ id: repositoryId, detail });
  }, [detailQuery.data, repositoryId]);

  const fetchedDetail = detailQuery.data?.detail ?? null;
  const keptDetail = lastDetail && lastDetail.id === repositoryId ? lastDetail.detail : null;
  const detail = fetchedDetail ?? keptDetail;
  const fetchError = detailQuery.data?.error ?? null;
  const repository = detail?.repository;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 active:bg-slate-700"
        >
          ← 返回清单
        </button>
        <button
          type="button"
          onClick={() => void detailQuery.refetch()}
          disabled={detailQuery.isFetching}
          className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-300 transition-colors hover:bg-emerald-500/20 active:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {detailQuery.isFetching ? <Spinner className="h-3.5 w-3.5" /> : null}
          {detailQuery.isFetching ? '抓取中…' : '重新抓取'}
        </button>
      </div>

      {/* 全量信息表头：仓库 + 轻量信息 */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h1 className="break-all font-mono text-lg font-semibold text-slate-100">
          {repository?.fullName ?? fullName}
        </h1>
        <div className="mt-1 text-xs text-slate-500">
          抓取于 {repository?.fetchedAt ? formatRelativeTime(repository.fetchedAt) : '尚未抓取'}
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <GlanceFact label="star 数" value={repository && repository.stars !== null ? String(repository.stars) : '—'} mono />
          <GlanceFact label="fork 数" value={repository && repository.forks !== null ? String(repository.forks) : '—'} mono />
          <GlanceFact
            label="最近动态时间"
            value={repository?.pushedAt ? formatRelativeTime(repository.pushedAt) : '—'}
            accent={isWithinDays(repository?.pushedAt ?? null, 7)}
          />
          <GlanceFact
            label="最新发版标签"
            value={repository ? repository.latestReleaseTag ?? '无发版' : '—'}
            mono
            muted={!repository?.latestReleaseTag}
          />
        </div>
      </div>

      {fetchError ? <ErrorBar error={fetchError} onGoSettings={onGoSettings} /> : null}
      {detailQuery.isError ? (
        <ErrorBar
          error={{ kind: 'unknown', message: '全量信息加载失败，请稍后重试' }}
          onGoSettings={onGoSettings}
          action={{ label: '重试', onClick: () => void detailQuery.refetch() }}
        />
      ) : null}

      {detailQuery.isPending && !detail ? (
        <Loading label="正在抓取全量信息…" />
      ) : detail ? (
        <div className={`space-y-4 transition-opacity ${detailQuery.isFetching ? 'opacity-60' : ''}`}>
          <Section title="发版">
            <ReleaseList releases={detail.releases} />
          </Section>
          <Section title="提交">
            <CommitList commits={detail.commits} />
          </Section>
          <Section title="议题与合并请求">
            <IssuesAndPulls issues={detail.issues} pullRequests={detail.pullRequests} />
          </Section>
          <Section title="构建状态">
            <BuildFacts build={detail.build} />
          </Section>
          <Section title="星标趋势">
            <TrendChart trend={detail.trend} />
          </Section>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/50 px-6 py-10 text-center text-sm text-slate-500">
          暂无全量信息，请点击"重新抓取"
        </div>
      )}
    </div>
  );
}
