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
import { formatShortDate } from '../lib/time';

// 只注册实际用到的 chart.js 模块
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const OPTIONS: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      position: 'bottom',
      labels: { color: '#94a3b8', boxWidth: 12, boxHeight: 12 },
    },
    tooltip: {
      backgroundColor: 'rgba(15,23,42,0.95)',
      titleColor: '#e2e8f0',
      bodyColor: '#cbd5e1',
      borderColor: 'rgba(100,116,139,0.4)',
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      ticks: { color: '#64748b', maxRotation: 0, autoSkip: true },
      grid: { color: 'rgba(51,65,85,0.4)' },
    },
    y: {
      ticks: { color: '#64748b' },
      grid: { color: 'rgba(51,65,85,0.4)' },
    },
  },
};

interface TrendChartProps {
  trend: Snapshot[];
}

/** 星标趋势：历史快照序列上的 star / fork 两条折线。 */
export function TrendChart({ trend }: TrendChartProps) {
  // 快照应按时间升序；入参顺序不保证，这里自行排序
  const ordered = [...trend].sort((a, b) => {
    const ta = new Date(a.capturedAt).getTime();
    const tb = new Date(b.capturedAt).getTime();
    return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
  });

  if (ordered.length < 2) {
    return (
      <div className="rounded-md border border-dashed border-slate-700 bg-slate-900/50 px-4 py-6 text-center text-xs text-slate-500">
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
        borderColor: '#34d399',
        backgroundColor: 'rgba(52,211,153,0.15)',
        tension: 0.25,
        spanGaps: true,
      },
      {
        label: 'fork 数',
        data: ordered.map((snapshot) => snapshot.forks),
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56,189,248,0.15)',
        tension: 0.25,
        spanGaps: true,
      },
    ],
  };

  return (
    <div className="h-64 w-full">
      <Line options={OPTIONS} data={data} />
    </div>
  );
}
