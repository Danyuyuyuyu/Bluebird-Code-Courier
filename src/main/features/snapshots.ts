import type Database from 'better-sqlite3';
import type { Snapshot } from '../../shared/types';

export interface SnapshotValues {
  stars: number | null;
  forks: number | null;
  openIssues: number | null;
  latestReleaseTag: string | null;
  pushedAt: string | null;
}

/** 本地日期（YYYY-MM-DD）：快照每日一档的去重键。 */
export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 历史快照记档：仅成功抓取后调用；同一仓库同一天只留一档（本地日期），
 * 当日再次抓取（含手动刷新）覆盖为最新值；缺省值（如无发版）记空。
 */
export function recordSnapshot(
  db: Database.Database,
  repositoryId: number,
  values: SnapshotValues,
  capturedAt: Date,
): void {
  db.prepare(
    `INSERT INTO snapshot (repository_id, captured_at, day, stars, forks, open_issues, latest_release_tag, pushed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(repository_id, day) DO UPDATE SET
       captured_at = excluded.captured_at,
       stars = excluded.stars,
       forks = excluded.forks,
       open_issues = excluded.open_issues,
       latest_release_tag = excluded.latest_release_tag,
       pushed_at = excluded.pushed_at`,
  ).run(
    repositoryId,
    capturedAt.toISOString(),
    localDateKey(capturedAt),
    values.stars,
    values.forks,
    values.openIssues,
    values.latestReleaseTag,
    values.pushedAt,
  );
}

/** 趋势读取：按时间升序的历史快照序列。 */
export function listSnapshots(db: Database.Database, repositoryId: number): Snapshot[] {
  const rows = db
    .prepare(
      'SELECT captured_at, stars, forks, open_issues, latest_release_tag, pushed_at FROM snapshot WHERE repository_id = ? ORDER BY captured_at ASC',
    )
    .all(repositoryId) as Array<{
    captured_at: string;
    stars: number | null;
    forks: number | null;
    open_issues: number | null;
    latest_release_tag: string | null;
    pushed_at: string | null;
  }>;
  return rows.map((row) => ({
    capturedAt: row.captured_at,
    stars: row.stars,
    forks: row.forks,
    openIssues: row.open_issues,
    latestReleaseTag: row.latest_release_tag,
    pushedAt: row.pushed_at,
  }));
}
