import type { Detail } from '../../../shared/types';
import { formatRelativeTime } from '../../lib/time';
import { GlanceFact } from '../GlanceFact';
import { Section } from '../Section';
import { BuildStatusBadge } from './BuildStatus';

/** 「构建」Tab：最近一次构建的完整状态（状态、工作流、完成时间、原始结论）。 */
export function BuildTab({ build }: { build: Detail['build'] }) {
  return (
    <Section title="构建">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <BuildStatusBadge status={build.status} />
        {build.workflowName ? <GlanceFact label="工作流" value={build.workflowName} /> : null}
        {build.finishedAt ? (
          <GlanceFact label="完成于" value={formatRelativeTime(build.finishedAt)} />
        ) : null}
        {build.conclusion ? (
          <GlanceFact label="结论" value={build.conclusion} mono muted />
        ) : null}
      </div>
      {build.status === 'none' ? (
        <p className="mt-2 text-xs text-muted">这个仓库没有可读的 GitHub Actions 构建。</p>
      ) : null}
    </Section>
  );
}
