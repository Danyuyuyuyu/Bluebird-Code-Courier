import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NormalizedError, AccessTokenResult } from '../../shared/types';
import { getApi } from '../lib/api';
import { ErrorBar } from '../components/ErrorBar';
import { Spinner } from '../components/Spinner';

interface SettingsPageProps {
  /** 令牌保存并验证成功后调用（App 负责跳转到监控清单）。 */
  onSaved: (message?: string) => void;
  onGoWatchlist: () => void;
}

const SUCCESS_SAVED = '访问令牌已保存并验证通过';
const SUCCESS_VALIDATED = '访问令牌有效';

function errorFrom(result: AccessTokenResult): NormalizedError {
  return result.error ?? { kind: 'unknown', message: '操作失败，请稍后重试' };
}

export function SettingsPage({ onSaved, onGoWatchlist }: SettingsPageProps) {
  const queryClient = useQueryClient();
  const accessTokenStateQuery = useQuery({
    queryKey: ['accessTokenState'],
    queryFn: () => getApi().accessTokenState(),
  });
  const configured = accessTokenStateQuery.data?.configured ?? false;

  const [accessToken, setAccessToken] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<NormalizedError | null>(null);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const savedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    };
  }, []);

  function showLocalError(message: string): void {
    setSuccess(null);
    setError({ kind: 'unknown', message });
  }

  async function handleSave(event: FormEvent): Promise<void> {
    event.preventDefault();
    const value = accessToken.trim();
    if (!value) {
      showLocalError('请输入访问令牌');
      return;
    }
    setSaving(true);
    setSuccess(null);
    setError(null);
    try {
      const result = await getApi().saveAccessToken(value);
      if (result.ok) {
        setSuccess(SUCCESS_SAVED);
        queryClient.setQueryData(['accessTokenState'], { configured: true });
        void queryClient.invalidateQueries({ queryKey: ['accessTokenState'] });
        // 让成功提示可见后再跳转
        if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
        savedTimerRef.current = window.setTimeout(() => {
          savedTimerRef.current = null;
          onSaved(SUCCESS_SAVED);
        }, 900);
      } else {
        setError(errorFrom(result));
      }
    } catch {
      showLocalError('保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  }

  async function handleValidate(): Promise<void> {
    const value = accessToken.trim();
    if (!value) {
      showLocalError('请输入访问令牌');
      return;
    }
    setValidating(true);
    setSuccess(null);
    setError(null);
    try {
      const result = await getApi().validateAccessToken(value);
      if (result.ok) {
        setSuccess(SUCCESS_VALIDATED);
      } else {
        setError(errorFrom(result));
      }
    } catch {
      showLocalError('校验失败，请稍后重试');
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-100">设置</h1>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-sm font-semibold text-slate-300">访问令牌</h2>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-slate-400">当前状态：</span>
          {accessTokenStateQuery.isPending ? (
            <span className="flex items-center gap-2 text-slate-500">
              <Spinner className="h-3.5 w-3.5" /> 读取中…
            </span>
          ) : (
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs ${
                configured
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
              }`}
            >
              {configured ? '已配置' : '未配置'}
            </span>
          )}
          {accessTokenStateQuery.isError ? (
            <button
              type="button"
              onClick={() => void accessTokenStateQuery.refetch()}
              className="rounded border border-white/20 px-2 py-0.5 text-xs text-slate-300 transition-colors hover:bg-white/10"
            >
              重新读取
            </button>
          ) : null}
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-3">
          <div>
            <label htmlFor="accessToken-input" className="mb-1 block text-xs text-slate-400">
              访问令牌
            </label>
            <input
              id="accessToken-input"
              type="password"
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              placeholder="ghp_…"
              autoComplete="off"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-slate-500">令牌只保存在本机，不会上传到任何服务器。</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 active:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Spinner className="h-3.5 w-3.5" /> : null}
              {saving ? '保存中…' : '保存并验证'}
            </button>
            <button
              type="button"
              onClick={() => void handleValidate()}
              disabled={validating}
              className="flex items-center gap-2 rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800 active:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {validating ? <Spinner className="h-3.5 w-3.5" /> : null}
              {validating ? '校验中…' : '校验'}
            </button>
          </div>
        </form>

        <div className="mt-3 space-y-2">
          {success ? (
            <div role="status" className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {success}
            </div>
          ) : null}
          {error ? <ErrorBar error={error} /> : null}
        </div>
      </section>

      {configured ? (
        <button
          type="button"
          onClick={onGoWatchlist}
          className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800 active:bg-slate-700"
        >
          ← 返回清单
        </button>
      ) : null}
    </div>
  );
}
