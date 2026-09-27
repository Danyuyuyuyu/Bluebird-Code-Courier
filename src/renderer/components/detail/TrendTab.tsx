import type { Detail } from '../../../shared/types';
import { Section } from '../Section';
import { TrendChart } from '../TrendChart';

/** 「趋势」Tab：完整 star / fork 双折线。 */
export function TrendTab({ trend }: { trend: Detail['trend'] }) {
  return (
    <Section title="趋势">
      <TrendChart trend={trend} />
    </Section>
  );
}
