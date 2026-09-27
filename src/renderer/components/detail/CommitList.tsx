import type { CommitItem } from '../../../shared/types';
import { formatRelativeTime } from '../../lib/time';

interface CommitListProps {
  commits: CommitItem[];
}

/**
 * 提交行：消息（第一视觉层，超长一行截断、title 露出全文）→ 作者 · 相对时间 → SHA。
 * SHA 用等宽弱色放在行末，只作定位用，不抢注意力。
 */
export function CommitList({ commits }: CommitListProps) {
  if (commits.length === 0) {
    return <p className="text-sm text-muted">无提交</p>;
  }
  return (
    <ul className="divide-y divide-subtle">
      {commits.map((commit, index) => (
        <li key={`${commit.sha}|${index}`} className="py-2 first:pt-0 last:pb-0">
          <div className="truncate text-sm text-primary" title={commit.message}>
            {commit.message}
          </div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
            <span className="text-secondary">{commit.authorName ?? '—'}</span>
            <span aria-hidden="true" className="text-muted">
              ·
            </span>
            <span className="text-muted">{formatRelativeTime(commit.committedAt)}</span>
            <span aria-hidden="true" className="text-muted">
              ·
            </span>
            <span className="font-mono text-muted">{commit.sha.slice(0, 7)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
