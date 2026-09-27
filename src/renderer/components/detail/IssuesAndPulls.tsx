import type { IssueItem, PullRequestItem } from '../../../shared/types';
import { formatRelativeTime } from '../../lib/time';

const STATE_STYLES = {
  open: 'border-success/40 bg-success-soft text-success',
  closed: 'border-strong bg-surface-raised text-muted',
} as const;

function StateBadge({ state }: { state: 'open' | 'closed' }) {
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${STATE_STYLES[state]}`}>
      {state === 'open' ? '开启' : '已关闭'}
    </span>
  );
}

interface NumberedItemRowProps {
  item: IssueItem | PullRequestItem;
}

/** 议题与合并请求共用的一行：#编号 → 标题 → 状态 → 作者 → 更新时间。 */
export function NumberedItemRow({ item }: NumberedItemRowProps) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0">
      <span className="font-mono text-xs text-muted">#{item.number}</span>
      <span className="min-w-0 flex-1 text-sm text-primary">{item.title}</span>
      <StateBadge state={item.state} />
      <span className="text-xs text-secondary">{item.authorName ?? '—'}</span>
      <span className="text-xs text-muted">{formatRelativeTime(item.updatedAt)}</span>
    </li>
  );
}

function NumberedItemList({ items }: { items: (IssueItem | PullRequestItem)[] }) {
  return (
    <ul className="divide-y divide-subtle">
      {items.map((item, index) => (
        <NumberedItemRow key={`${item.number}|${index}`} item={item} />
      ))}
    </ul>
  );
}

interface IssuesAndPullsProps {
  issues: IssueItem[];
  pullRequests: PullRequestItem[];
}

/** 议题与合并请求的完整列表（「Issue & PR」Tab）。 */
export function IssuesAndPulls({ issues, pullRequests }: IssuesAndPullsProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-1 text-xs font-medium text-secondary">议题</h3>
        {issues.length === 0 ? (
          <p className="text-sm text-muted">无议题</p>
        ) : (
          <NumberedItemList items={issues} />
        )}
      </div>
      <div>
        <h3 className="mb-1 text-xs font-medium text-secondary">合并请求</h3>
        {pullRequests.length === 0 ? (
          <p className="text-sm text-muted">无合并请求</p>
        ) : (
          <NumberedItemList items={pullRequests} />
        )}
      </div>
    </div>
  );
}
