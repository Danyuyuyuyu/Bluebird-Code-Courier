import type Database from 'better-sqlite3';
import type { Clock } from '../core/clock';
import type { BuildRun, GitHubPort, IssueOrPullRequest } from '../core/github/port';
import type {
  BuildInfo,
  BuildStatus,
  CommitItem,
  Detail,
  Glance,
  IssueItem,
  PullRequestItem,
  ReleaseItem,
} from '../../shared/types';
import { listSnapshots, recordSnapshot } from './snapshots';
import {
  findRepositoryRow,
  updateRepositoryGlance,
  rowToGlance,
  type GlanceValues,
} from './watchlist';

/**
 * 抓取编排。
 *
 * 轻量抓取（每仓库两次调用）：仓库元数据（star / fork / open issues / 最近推送时间）+ 最新发版。
 * 全量抓取（每次四类调用）：发版列表、提交列表、议题与合并请求列表（同一端点按 pull_request 标记拆分）、
 * 构建状态（最近一次构建结论）。趋势不调接口、只读快照。
 *
 * 仅成功抓取后记历史快照（每天一档，手动刷新同样记档）。
 */
export async function fetchGlanceValues(
  github: GitHubPort,
  token: string,
  fullName: string,
): Promise<GlanceValues> {
  const meta = await github.getRepositoryMeta(token, fullName);
  const latestRelease = await github.getLatestRelease(token, fullName);
  return {
    stars: meta.stars,
    forks: meta.forks,
    openIssues: meta.openIssues,
    pushedAt: meta.pushedAt,
    latestReleaseTag: latestRelease?.tagName ?? null,
  };
}

/** 成功抓取的落库动作：更新展示字段 + 记历史快照，返回最新轻量信息。 */
export function applyGlanceValues(
  db: Database.Database,
  clock: Clock,
  repositoryId: number,
  values: GlanceValues,
): Glance {
  const capturedAt = clock.now();
  updateRepositoryGlance(db, repositoryId, values, capturedAt.toISOString());
  recordSnapshot(db, repositoryId, values, capturedAt);
  const row = findRepositoryRow(db, repositoryId);
  if (!row) throw new Error(`仓库不存在：${repositoryId}`);
  return rowToGlance(row);
}

// ---------- 全量抓取 ----------

export interface DetailValues {
  releases: ReleaseItem[];
  commits: CommitItem[];
  issues: IssueItem[];
  pullRequests: PullRequestItem[];
  build: BuildInfo;
}

/**
 * 全量抓取（四类调用）：发版列表、提交列表、议题与合并请求列表（同一端点按 pull_request
 * 标记拆分）、构建状态（最近一次构建结论）。趋势不调接口、只读快照。
 */
export async function fetchDetailValues(
  github: GitHubPort,
  token: string,
  fullName: string,
): Promise<DetailValues> {
  const releases = await github.listReleases(token, fullName);
  const commits = await github.listCommits(token, fullName);
  const issuesAndPullRequests = await github.listIssues(token, fullName);
  const latestBuild = await github.getLatestBuild(token, fullName);

  const issues: IssueItem[] = [];
  const pullRequests: PullRequestItem[] = [];
  for (const item of issuesAndPullRequests) {
    const { hasPullRequest, ...rest } = item;
    if (hasPullRequest) pullRequests.push(rest);
    else issues.push(rest);
  }

  return {
    releases,
    commits,
    issues,
    pullRequests,
    build: toBuildInfo(latestBuild),
  };
}

/** 构建结论归一为构建状态徽章；没有构建 = "无构建"空态。 */
export function toBuildInfo(run: BuildRun | null): BuildInfo {
  if (run === null) {
    return { status: 'none', conclusion: null, workflowName: null, url: null, finishedAt: null };
  }
  return {
    status: buildStatusOf(run),
    conclusion: run.conclusion,
    workflowName: run.workflowName,
    url: run.url,
    finishedAt: run.finishedAt,
  };
}

function buildStatusOf(run: BuildRun): Exclude<BuildStatus, 'none'> {
  const conclusion = run.conclusion;
  if (conclusion === null) return 'pending';
  if (conclusion === 'success') return 'success';
  if (
    conclusion === 'failure' ||
    conclusion === 'timed_out' ||
    conclusion === 'action_required' ||
    conclusion === 'startup_failure'
  ) {
    return 'failure';
  }
  return 'neutral';
}

/**
 * 全量抓取成功的落库动作。
 * 全量不含元数据调用：指标沿用最近一次轻量抓取的值，最新发版标签以本次发版列表为准；
 * 快照记"抓取时刻已知的最新指标值"（手动刷新同样记档）。
 */
export function applyDetailValues(
  db: Database.Database,
  clock: Clock,
  repositoryId: number,
  values: DetailValues,
): Detail {
  const row = findRepositoryRow(db, repositoryId);
  if (!row) throw new Error(`仓库不存在：${repositoryId}`);

  const capturedAt = clock.now();
  const latestReleaseTag = values.releases[0]?.tagName ?? null;
  db.prepare('UPDATE repository SET latest_release_tag = ?, fetched_at = ? WHERE id = ?').run(
    latestReleaseTag,
    capturedAt.toISOString(),
    repositoryId,
  );
  recordSnapshot(
    db,
    repositoryId,
    {
      stars: row.stars,
      forks: row.forks,
      openIssues: row.open_issues,
      latestReleaseTag,
      pushedAt: row.pushed_at,
    },
    capturedAt,
  );

  const updated = findRepositoryRow(db, repositoryId);
  if (!updated) throw new Error(`仓库不存在：${repositoryId}`);
  return {
    repository: rowToGlance(updated),
    releases: values.releases,
    commits: values.commits,
    issues: values.issues,
    pullRequests: values.pullRequests,
    build: values.build,
    trend: listSnapshots(db, repositoryId),
  };
}
