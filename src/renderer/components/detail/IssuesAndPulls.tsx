import type { IssueItem, PullRequestItem } from '../../../shared/types';
import { formatRelativeTime } from '../../lib/time';
import { GlanceFact } from '../GlanceFact';

const STATE_STYLES = {
  open: 'border-success/40 bg-success-soft text-success',
  closed: 'border-strong bg-surface-raised text-muted',
} as const;

/** 条目类型：文字写在徽章里，颜色只是辅助（不能只靠颜色区分 Issue / PR）。 */
export type ItemKind = 'issue' | 'pull';

const KIND_STYLES: Record<ItemKind, { label: string; tone: string }> = {
  issue: { label: 'Issue', tone: 'border-info/40 bg-info-soft text-info' },
  pull: { label: 'PR', tone: 'border-accent/40 bg-accent-soft text-accent' },
};

function StateBadge({ state }: { state: 'open' | 'closed' }) {
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${STATE_STYLES[state]}`}>
      {state === 'open' ? '开启' : '已关闭'}
    </span>
  );
}

function KindBadge({ kind }: { kind: ItemKind }) {
  const { label, tone } = KIND_STYLES[kind];
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${tone}`}>{label}</span>;
}

interface NumberedItemRowProps {
  item: IssueItem | PullRequestItem;
  kind: ItemKind;
}

/** 议题与合并请求共用的一行：类型 → #编号 → 标题 → 状态 → 作者 → 更新时间。 */
export function NumberedItemRow({ item, kind }: NumberedItemRowProps) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0">
      <KindBadge kind={kind} />
      <span className="font-mono text-xs text-muted">#{item.number}</span>
      <span className="min-w-0 flex-1 text-sm text-primary">{item.title}</span>
      <StateBadge state={item.state} />
      <span className="text-xs text-secondary">{item.authorName ?? '—'}</span>
      <span className="text-xs text-muted">{formatRelativeTime(item.updatedAt)}</span>
    </li>
  );
}

function NumberedItemList({ items, kind }: { items: (IssueItem | PullRequestItem)[]; kind: ItemKind }) {
  return (
    <ul className="divide-y divide-subtle">
      {items.map((item, index) => (
        <NumberedItemRow key={`${item.number}|${index}`} item={item} kind={kind} />
      ))}
    </ul>
  );
}

interface IssuesAndPullsProps {
  issues: IssueItem[];
  pullRequests: PullRequestItem[];
}

/** 议题与合并请求的完整列表（「Issue & PR」Tab）：先给计数摘要，再分区展示。 */
export function IssuesAndPulls({ issues, pullRequests }: IssuesAndPullsProps) {
  if (issues.length === 0 && pullRequests.length === 0) {
    return <p className="text-sm text-secondary">✓ 当前没有开放的 Issue 或 Pull Request</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <GlanceFact label="议题" value={`${issues.length} 条`} />
        <GlanceFact label="合并请求" value={`${pullRequests.length} 条`} />
      </div>

      {issues.length > 0 ? (
        <div>
          <h3 className="mb-1 text-xs font-medium text-secondary">议题</h3>
          <NumberedItemList items={issues} kind="issue" />
        </div>
      ) : null}

      {pullRequests.length > 0 ? (
        <div>
          <h3 className="mb-1 text-xs font-medium text-secondary">合并请求</h3>
          <NumberedItemList items={pullRequests} kind="pull" />
        </div>
      ) : null}
    </div>
  );
}
