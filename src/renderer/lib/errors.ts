import type { NormalizedError } from '../../shared/types';
import { formatClock } from './time';

/** 错误类别 → 面向用户的展示文案。 */
export function describeError(error: NormalizedError): string {
  switch (error.kind) {
    case 'access_token_invalid':
      return '令牌无效，请检查后重试';
    case 'rate_limited':
      return error.resetAt
        ? `限流，预计 ${formatClock(error.resetAt)} 后恢复`
        : '抓取受限流影响，请稍后再试';
    case 'network':
      return '网络失败，请检查网络连接后重试';
    case 'not_found':
      return error.message || '仓库不存在或无访问权限';
    case 'unknown':
      return error.message || '发生未知错误，请稍后重试';
    default:
      return error.message || '发生未知错误，请稍后重试';
  }
}

/**
 * 按 kind + message 去重（批量抓取时同一故障会逐仓库重复上报），
 * 保留首个出现的错误（含 resetAt / fullName 上下文）。
 */
export function dedupeErrors(errors: NormalizedError[]): NormalizedError[] {
  const seen = new Set<string>();
  const result: NormalizedError[] = [];
  for (const error of errors) {
    const key = `${error.kind}|${error.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(error);
  }
  return result;
}
