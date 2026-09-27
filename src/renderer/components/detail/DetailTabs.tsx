export type DetailTabId = 'overview' | 'releases' | 'commits' | 'issues' | 'build' | 'trend';

const TABS: ReadonlyArray<{ id: DetailTabId; label: string }> = [
  { id: 'overview', label: '概览' },
  { id: 'releases', label: '发版' },
  { id: 'commits', label: '提交' },
  { id: 'issues', label: 'Issue & PR' },
  { id: 'build', label: '构建' },
  { id: 'trend', label: '趋势' },
];

interface DetailTabsProps {
  active: DetailTabId;
  onChange: (id: DetailTabId) => void;
}

/** 仓库详情内部的二级导航；窄窗口下横向滚动，不换行挤压标题。 */
export function DetailTabs({ active, onChange }: DetailTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="仓库详情分区"
      className="flex gap-1 overflow-x-auto border-b border-default"
    >
      {TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`detail-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`detail-panel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
              selected
                ? 'border-accent text-accent'
                : 'border-transparent text-secondary hover:border-strong hover:text-primary'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
