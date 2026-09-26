import type { OctoBridge } from '../../shared/types';

/**
 * 渲染层唯一数据入口：preload 暴露的用例门面。
 * 不使用 fetch / localStorage，一切数据都经 window.octo 获取。
 */
export function getApi(): OctoBridge {
  return window.octo;
}
