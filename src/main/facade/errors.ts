import { GitHubRequestError } from '../core/github/port';
import type { NormalizedError } from '../../shared/types';

/**
 * 错误归一：五类 —— 令牌无效、限流（带恢复时间）、不存在/无权限、网络失败、未知。
 * 一切抓取错误都经此映射后才离开主进程。
 */
export function normalizeError(error: unknown, fullName?: string): NormalizedError {
  const context = fullName === undefined ? {} : { fullName };

  if (error instanceof GitHubRequestError) {
    if (error.status === 401) {
      return {
        kind: 'token_invalid',
        message: '访问令牌无效，请到设置页更换令牌',
        ...context,
      };
    }
    const resetAt = rateLimitResetAt(error);
    if (resetAt !== undefined) {
      return {
        kind: 'rate_limited',
        message: '抓取被 GitHub 限流，配额恢复前暂不可用',
        resetAt,
        ...context,
      };
    }
    if (error.status === 404 || error.status === 403) {
      return {
        kind: 'not_found',
        message: '仓库不存在或无权访问',
        ...context,
      };
    }
    return {
      kind: 'unknown',
      message: `抓取失败（HTTP ${error.status}）`,
      ...context,
    };
  }

  // 与 fetch 的网络层失败一致（TypeError: fetch failed）
  if (error instanceof TypeError) {
    return {
      kind: 'network',
      message: '网络失败，请检查网络后重试',
      ...context,
    };
  }

  return {
    kind: 'unknown',
    message: '发生未知错误',
    ...context,
  };
}

function rateLimitResetAt(error: GitHubRequestError): string | undefined {
  const remaining = error.headers['x-ratelimit-remaining'];
  const isRateLimited =
    error.status === 429 || (error.status === 403 && (remaining === '0' || remaining === undefined && 'x-ratelimit-reset' in error.headers));
  if (!isRateLimited) return undefined;

  const reset = error.headers['x-ratelimit-reset'];
  if (reset && /^\d+$/.test(reset)) {
    return new Date(Number(reset) * 1000).toISOString();
  }
  const retryAfter = error.headers['retry-after'];
  if (retryAfter && /^\d+$/.test(retryAfter)) {
    return new Date(Date.now() + Number(retryAfter) * 1000).toISOString();
  }
  return undefined;
}
