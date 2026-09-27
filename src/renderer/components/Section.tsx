import type { ReactNode } from 'react';

interface SectionProps {
  /** 更新类别名称（发版 / 提交 / 议题与合并请求 / 构建状态 / 星标趋势）。 */
  title: string;
  children: ReactNode;
}

/** 全量信息里的一个更新类别区块。 */
export function Section({ title, children }: SectionProps) {
  return (
    <section className="rounded-lg border border-default bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-primary">{title}</h2>
      {children}
    </section>
  );
}
