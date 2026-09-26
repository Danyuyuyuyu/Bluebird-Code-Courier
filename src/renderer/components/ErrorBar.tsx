import type { NormalizedError } from '../../shared/types';
import { describeError } from '../lib/errors';

const KIND_STYLES: Record<NormalizedError['kind'], string> = {
  token_invalid: 'border-red-500/40 bg-red-500/10 text-red-200',
  rate_limited: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  not_found: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  network: 'border-orange-500/40 bg-orange-500/10 text-orange-200',
  unknown: 'border-slate-600 bg-slate-800/80 text-slate-300',
};

interface ErrorBarProps {
  error: NormalizedError;
  /** 令牌无效时展示"去设置"入口。 */
  onGoSettings?: () => void;
  /** 附加操作按钮（如"重试"）。 */
  action?: { label: string; onClick: () => void };
}

/** 单条归一化错误的紧凑提示条，按错误类别着色。 */
export function ErrorBar({ error, onGoSettings, action }: ErrorBarProps) {
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-sm ${KIND_STYLES[error.kind]}`}
    >
      {error.fullName ? (
        <span className="font-mono text-xs opacity-80">{error.fullName}</span>
      ) : null}
      <span className="min-w-0 flex-1">{describeError(error)}</span>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="shrink-0 rounded border border-white/20 px-2 py-0.5 text-xs opacity-90 transition-colors hover:bg-white/10 active:bg-white/15"
        >
          {action.label}
        </button>
      ) : null}
      {error.kind === 'token_invalid' && onGoSettings ? (
        <button
          type="button"
          onClick={onGoSettings}
          className="shrink-0 rounded border border-white/20 px-2 py-0.5 text-xs opacity-90 transition-colors hover:bg-white/10 active:bg-white/15"
        >
          去设置
        </button>
      ) : null}
    </div>
  );
}
