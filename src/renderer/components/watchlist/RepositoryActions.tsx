import { useEffect, useRef, useState } from 'react';
import type { Glance } from '../../../shared/types';
import { getApi } from '../../lib/api';
import { describeOpenFailure } from '../../lib/external-link';
import { RemoveRepositoryPopover } from './RemoveRepositoryPopover';

/** closed → 无浮层；menu → ··· 菜单；confirm → 移除确认 Popover。 */
type Stage = 'closed' | 'menu' | 'confirm';

interface RepositoryActionsProps {
  repo: Glance;
  /** 移除失败时必须 reject，由本组件就地提示并允许重试。 */
  onRemove: (repositoryId: number) => Promise<void>;
}

/** 仓库的次要操作入口：`···` 菜单 + 移除确认 Popover，两者都从卡片主点击区里独立出来。 */
export function RepositoryActions({ repo, onRemove }: RepositoryActionsProps) {
  const [stage, setStage] = useState<Stage>('closed');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItemRef = useRef<HTMLButtonElement>(null);

  const open = stage !== 'closed';

  // 浮层打开期间的通用退出：Esc 关闭并交还焦点；点浮层外部关闭
  useEffect(() => {
    if (!open) return;
    function close(): void {
      setStage('closed');
      setError(null);
      triggerRef.current?.focus();
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape' && !busy) close();
    }
    function handlePointerDown(event: MouseEvent): void {
      if (busy) return;
      if (!containerRef.current?.contains(event.target as Node)) {
        setStage('closed');
        setError(null);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open, busy]);

  // 菜单打开后把焦点交给菜单项
  useEffect(() => {
    if (stage === 'menu') menuItemRef.current?.focus();
  }, [stage]);

  async function handleConfirm(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await onRemove(repo.id);
      setStage('closed');
    } catch {
      setError('删除失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  /** 跳 GitHub：成功了才收起菜单；失败时菜单留着，就地报错，不让人误以为已经跳走。 */
  async function handleOpenExternal(): Promise<void> {
    // 调用期间锁住菜单：否则结果回来时菜单已被点掉，失败提示就没地方显示
    setBusy(true);
    setError(null);
    try {
      const result = await getApi().openGitHubExternal({
        kind: 'repository',
        owner: repo.owner,
        name: repo.name,
      });
      if (!result.ok) {
        setError(describeOpenFailure(result.reason));
        return;
      }
      setStage('closed');
      triggerRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${repo.fullName} 的仓库操作`}
        onClick={() => setStage(stage === 'closed' ? 'menu' : 'closed')}
        className="rounded-md px-2 py-1 text-secondary transition-colors hover:bg-surface-hover hover:text-primary active:bg-surface-active"
      >
        ···
      </button>

      {stage === 'menu' ? (
        <div
          role="menu"
          aria-label="仓库操作"
          className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border border-strong bg-surface py-1 shadow-md"
        >
          <button
            ref={menuItemRef}
            type="button"
            role="menuitem"
            aria-label={`在 GitHub 打开 ${repo.fullName}`}
            onClick={() => void handleOpenExternal()}
            className="block w-full px-3 py-1.5 text-left text-sm text-primary transition-colors hover:bg-surface-hover active:bg-surface-active"
          >
            在 GitHub 打开
          </button>
          <div role="separator" className="my-1 border-t border-subtle" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setError(null);
              setStage('confirm');
            }}
            className="block w-full px-3 py-1.5 text-left text-sm text-primary transition-colors hover:bg-surface-hover active:bg-surface-active"
          >
            从监控清单移除
          </button>
          {error ? (
            <p role="alert" className="px-3 py-1.5 text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {stage === 'confirm' ? (
        <RemoveRepositoryPopover
          fullName={repo.fullName}
          busy={busy}
          error={error}
          onCancel={() => {
            setStage('closed');
            setError(null);
            triggerRef.current?.focus();
          }}
          onConfirm={() => void handleConfirm()}
        />
      ) : null}
    </div>
  );
}
