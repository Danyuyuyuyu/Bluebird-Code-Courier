import Database from 'better-sqlite3';

/**
 * 本地数据库（SQLite 真文件）。表结构与语义对齐 v1 spec 的 Implementation Decisions：
 *
 * - repository：监控仓库 + 最近一次成功抓取的展示字段
 * - snapshot：历史快照，唯一约束（repository_id + 本地日期）
 * - setting：访问令牌（加密存放）与偏好项
 *
 * 迁移以 PRAGMA user_version 递增，逐条应用；重复打开幂等。
 */

/** v1 建表。snapshot 的 `day` 即"本地日期"，是唯一约束的物化列。 */
function migrationV1(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS repository (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner TEXT NOT NULL,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL UNIQUE,
      added_at TEXT NOT NULL,
      stars INTEGER,
      forks INTEGER,
      open_issues INTEGER,
      pushed_at TEXT,
      latest_release_tag TEXT,
      fetched_at TEXT
    );

    CREATE TABLE IF NOT EXISTS snapshot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repository_id INTEGER NOT NULL REFERENCES repository(id) ON DELETE CASCADE,
      captured_at TEXT NOT NULL,
      day TEXT NOT NULL,
      stars INTEGER,
      forks INTEGER,
      open_issues INTEGER,
      latest_release_tag TEXT,
      pushed_at TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshot_repository_day
      ON snapshot (repository_id, day);

    CREATE TABLE IF NOT EXISTS setting (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

const MIGRATIONS: ReadonlyArray<(db: Database.Database) => void> = [migrationV1];

function migrate(db: Database.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  for (let version = current; version < MIGRATIONS.length; version += 1) {
    const apply = MIGRATIONS[version];
    if (!apply) continue;
    db.transaction(() => {
      apply(db);
      db.pragma(`user_version = ${version + 1}`);
    })();
  }
}

export function openDatabase(pathname: string): Database.Database {
  const db = new Database(pathname);
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}
