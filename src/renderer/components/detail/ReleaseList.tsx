import type { ReleaseItem } from '../../../shared/types';
import { formatDate } from '../../lib/time';

interface ReleaseListProps {
  releases: ReleaseItem[];
}

/** 发版行：标签 → 标题 → 发布日期；概览摘要与「发版」Tab 共用同一份数据与渲染。 */
export function ReleaseList({ releases }: ReleaseListProps) {
  if (releases.length === 0) {
    return <p className="text-sm text-muted">无发版</p>;
  }
  return (
    <ul className="divide-y divide-subtle">
      {releases.map((release, index) => (
        <li
          key={`${release.tagName}|${index}`}
          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0"
        >
          <span className="font-mono text-xs text-accent">{release.tagName}</span>
          <span className="min-w-0 flex-1 text-sm text-primary">{release.title}</span>
          <span className="text-xs text-muted">{formatDate(release.publishedAt)}</span>
        </li>
      ))}
    </ul>
  );
}
