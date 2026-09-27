import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import type { ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { Snapshot } from '../../shared/types';
import { resolveChartPalette } from '../lib/chart-theme';
import type { ChartPalette } from '../lib/chart-theme';
import { useEffectiveTheme } from '../lib/theme';
import { formatShortDate } from '../lib/time';

// 只注册实际用到的 chart.js 模块
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

/** 坐标轴、图例、提示框的配色全部来自当前主题，主题切换时随 effective theme 重建。 */
function chartOptions(palette: ChartPalette): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: palette.label, boxWidth: 12, boxHeight: 12 },
      },
      tooltip: {
        backgroundColor: palette.tooltip,
        titleColor: palette.tooltipText,
        bodyColor: palette.tooltipText,
        borderColor: palette.grid,
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: { color: palette.label, maxRotation: 0, autoSkip: true },
        grid: { color: palette.grid },
      },
      y: {
        ticks: { color: palette.label },
        grid: { color: palette.grid },
      },
    },
  };
}

interface TrendChartProps {
  trend: Snapshot[];
  /** 概览摘要里压低高度，完整趋势仍在「趋势」Tab。 */
  compact?: boolean;
}

/** 星标趋势：历史快照序列上的 star / fork 两条折线。 */
export function TrendChart({ trend, compact = false }: TrendChartProps) {
  const theme = useEffectiveTheme();
  const palette = resolveChartPalette(theme);

  // 快照应按时间升序；入参顺序不保证，这里自行排序
  const ordered = [...trend].sort((a, b) => {
    const ta = new Date(a.capturedAt).getTime();
    const tb = new Date(b.capturedAt).getTime();
    return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
  });

  if (ordered.length < 2) {
    return (
      <div className="rounded-md border border-dashed border-strong bg-surface/50 px-4 py-6 text-center text-xs text-muted">
        趋势随使用积累，多用几天就有啦
      </div>
    );
  }

  const data = {
    labels: ordered.map((snapshot) => formatShortDate(snapshot.capturedAt)),
    datasets: [
      {
        label: 'star 数',
        data: ordered.map((snapshot) => snapshot.stars),
        borderColor: palette.star,
        backgroundColor: palette.star,
        tension: 0.25,
        spanGaps: true,
      },
      {
        label: 'fork 数',
        data: ordered.map((snapshot) => snapshot.forks),
        borderColor: palette.fork,
        backgroundColor: palette.fork,
        tension: 0.25,
        spanGaps: true,
      },
    ],
  };

  return (
    <div className={`w-full ${compact ? 'h-36' : 'h-64'}`}>
      <Line options={chartOptions(palette)} data={data} />
    </div>
  );
}
