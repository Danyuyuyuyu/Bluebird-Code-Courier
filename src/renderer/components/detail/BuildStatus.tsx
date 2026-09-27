import type { BuildStatus } from '../../../shared/types';

export const BUILD_LABELS: Record<BuildStatus, string> = {
  success: '构建通过',
  failure: '构建失败',
  pending: '构建中',
  neutral: '构建无结论',
  none: '无构建',
};

/** 徽章与左侧圆点共用的状态色（success / failure / pending / neutral / none）。 */
export const BUILD_TONES: Record<BuildStatus, { badge: string; dot: string }> = {
  success: { badge: 'border-success/40 bg-success-soft text-success', dot: 'bg-success' },
  failure: { badge: 'border-danger/40 bg-danger-soft text-danger', dot: 'bg-danger' },
  pending: { badge: 'border-warning/40 bg-warning-soft text-warning', dot: 'bg-warning' },
  neutral: { badge: 'border-strong bg-surface-raised text-secondary', dot: 'bg-muted' },
  none: { badge: 'border-strong bg-surface-raised text-muted', dot: 'bg-strong' },
};

interface BuildStatusBadgeProps {
  status: BuildStatus;
}

/** 构建状态徽章：颜色与圆点语义对齐全应用；作为高权重信息，字号大于普通徽章。 */
export function BuildStatusBadge({ status }: BuildStatusBadgeProps) {
  const tone = BUILD_TONES[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-sm ${tone.badge}`}
    >
      <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {BUILD_LABELS[status]}
    </span>
  );
}
