import type Database from 'better-sqlite3';
import type { CipherBox } from '../core/cipher/cipher-box';

/** setting 表：访问令牌（密文）与偏好项的键名约定。 */
export const ACCESS_TOKEN_KEY = 'access_token';
export const PREFERENCE_PREFIX = 'pref:';

export function readRawSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM setting WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function writeSetting(db: Database.Database, key: string, value: string): void {
  db.prepare(
    `INSERT INTO setting (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

export function deleteSetting(db: Database.Database, key: string): void {
  db.prepare('DELETE FROM setting WHERE key = ?').run(key);
}

/** 读取访问令牌明文；未配置或密文损坏时返回 null。 */
export function readAccessToken(db: Database.Database, cipher: CipherBox): string | null {
  const raw = readRawSetting(db, ACCESS_TOKEN_KEY);
  if (raw === null) return null;
  try {
    return cipher.decrypt(raw);
  } catch {
    return null;
  }
}

export function writeAccessToken(db: Database.Database, cipher: CipherBox, accessToken: string): void {
  writeSetting(db, ACCESS_TOKEN_KEY, cipher.encrypt(accessToken));
}

export function readPreferences(db: Database.Database): Record<string, string> {
  const rows = db
    .prepare('SELECT key, value FROM setting WHERE key LIKE ?')
    .all(`${PREFERENCE_PREFIX}%`) as Array<{ key: string; value: string }>;
  const preferences: Record<string, string> = {};
  for (const row of rows) preferences[row.key.slice(PREFERENCE_PREFIX.length)] = row.value;
  return preferences;
}

export function writePreferences(db: Database.Database, patch: Record<string, string>): void {
  const upsert = db.prepare(
    `INSERT INTO setting (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
  db.transaction(() => {
    for (const [key, value] of Object.entries(patch)) upsert.run(`${PREFERENCE_PREFIX}${key}`, value);
  })();
}
