import type { CommitItem } from '../../../shared/types';
import { formatRelativeTime } from '../../lib/time';

interface CommitListProps {
  commits: CommitItem[];
}

/** 提交行：消息 → 作者 · 时间 → SHA（SHA 只做次要信息，不占第一视觉层级）。 */
export function CommitList({ commits }: CommitListProps) {
  if (commits.length === 0) {
    return <p className="text-sm text-muted">无提交</p>;
  }
  return (
    <ul className="divide-y divide-subtle">
      {commits.map((commit, index) => (
        <li key={`${commit.sha}|${index}`} className="py-2 first:pt-0 last:pb-0">
          <div className="text-sm text-primary">{commit.message}</div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted">
            <span>{commit.authorName ?? '—'}</span>
            <span aria-hidden="true">·</span>
            <span>{formatRelativeTime(commit.committedAt)}</span>
            <span className="font-mono">{commit.sha.slice(0, 7)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
