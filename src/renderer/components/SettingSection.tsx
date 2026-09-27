import type { ReactNode } from 'react';

interface SettingSectionProps {
  title: string;
  children: ReactNode;
}

/** 设置页的一个分组：标题 + 分隔线 + 内容。 */
export function SettingSection({ title, children }: SettingSectionProps) {
  return (
    <section className="rounded-lg border border-default bg-surface p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-primary">{title}</h2>
      <div className="mt-3 border-t border-subtle pt-4">{children}</div>
    </section>
  );
}
