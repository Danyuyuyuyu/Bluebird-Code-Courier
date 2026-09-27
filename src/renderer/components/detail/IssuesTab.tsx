import type { Detail } from '../../../shared/types';
import { Section } from '../Section';
import { IssuesAndPulls } from './IssuesAndPulls';

/** 「Issue & PR」Tab：完整议题与合并请求列表。 */
export function IssuesTab({
  issues,
  pullRequests,
}: {
  issues: Detail['issues'];
  pullRequests: Detail['pullRequests'];
}) {
  return (
    <Section title="Issue & PR">
      <IssuesAndPulls issues={issues} pullRequests={pullRequests} />
    </Section>
  );
}
