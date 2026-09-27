import type { Detail, IssueItem, PullRequestItem } from '../../../shared/types';
import { formatRelativeTime } from '../../lib/time';
import { GlanceFact } from '../GlanceFact';
import { Section } from '../Section';
import { TrendChart } from '../TrendChart';
import { BuildStatusBadge } from './BuildStatus';
import { CommitList } from './CommitList';
import { NumberedItemRow } from './IssuesAndPulls';
import { ReleaseList } from './ReleaseList';

/** 概览每条摘要最多显示几条；完整内容仍在各自 Tab。 */
const SUMMARY_LIMIT = 5;

interface OverviewTabProps {
  detail: Detail;
}

function byUpdatedDesc(a: IssueItem | PullRequestItem, b: IssueItem | PullRequestItem): number {
  return (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0);
}

function RecentList({
  title,
  items,
}: {
  title: string;
  items: (IssueItem | PullRequestItem)[];
}) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-medium text-secondary">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted">无</p>
      ) : (
        <ul className="divide-y divide-subtle">
          {items.map((item, index) => (
            <NumberedItemRow key={`${item.number}|${index}`} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** 概览：第一屏回答"这个仓库最近怎么样"——构建是否正常、最近发了什么、最近在改什么。 */
export function OverviewTab({ detail }: OverviewTabProps) {
  const { build, releases, commits, issues, pullRequests, trend } = detail;
  const openIssues = issues.filter((issue) => issue.state === 'open').length;
  const openPulls = pullRequests.filter((pull) => pull.state === 'open').length;
  const noIssuesAtAll = issues.length === 0 && pullRequests.length === 0;

  return (
    <div className="space-y-4">
      <Section title="构建状态">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <BuildStatusBadge status={build.status} />
          {build.workflowName ? <GlanceFact label="工作流" value={build.workflowName} /> : null}
          {build.finishedAt ? (
            <GlanceFact label="完成于" value={formatRelativeTime(build.finishedAt)} />
          ) : null}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="最新发版">
          <ReleaseList releases={releases.slice(0, SUMMARY_LIMIT)} />
          {releases.length > SUMMARY_LIMIT ? (
            <p className="mt-2 text-xs text-muted">
              仅显示最近 {SUMMARY_LIMIT} 条，共 {releases.length} 条
            </p>
          ) : null}
        </Section>

        <Section title="最近提交">
          <CommitList commits={commits.slice(0, SUMMARY_LIMIT)} />
          {commits.length > SUMMARY_LIMIT ? (
            <p className="mt-2 text-xs text-muted">
              仅显示最近 {SUMMARY_LIMIT} 条，共 {commits.length} 条
            </p>
          ) : null}
        </Section>
      </div>

      <Section title="Issue & PR">
        {noIssuesAtAll ? (
          <p className="text-sm text-secondary">✓ 当前没有开放的 Issue 或 Pull Request</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <GlanceFact
                label="议题"
                value={`开启 ${openIssues} · 已关闭 ${issues.length - openIssues}`}
              />
              <GlanceFact
                label="合并请求"
                value={`开启 ${openPulls} · 已关闭 ${pullRequests.length - openPulls}`}
              />
            </div>
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
              <RecentList
                title="最近更新的议题"
                items={[...issues].sort(byUpdatedDesc).slice(0, 3)}
              />
              <RecentList
                title="最近更新的合并请求"
                items={[...pullRequests].sort(byUpdatedDesc).slice(0, 3)}
              />
            </div>
          </div>
        )}
      </Section>

      <Section title="趋势摘要">
        <TrendChart trend={trend} compact />
      </Section>
    </div>
  );
}
