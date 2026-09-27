interface GlanceFactProps {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
  muted?: boolean;
}

/** 轻量信息 / 全量信息表头里的一条"标签 + 值"事实。 */
export function GlanceFact({ label, value, mono = false, accent = false, muted = false }: GlanceFactProps) {
  const valueColor = accent ? 'text-accent' : muted ? 'text-muted' : 'text-primary';
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-sm ${valueColor} ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
