import type Database from 'better-sqlite3';
import type { Clock } from '../core/clock';
import type { GitHubPort } from '../core/github/port';
import type { SecretBox } from '../core/secrets/secret-box';
import { silentLogger, type Logger } from '../core/logging/logger';
import type {
  AddRepositoryResult,
  DetailResult,
  Glance,
  NormalizedError,
  OctoFacade,
  RefreshGlanceResult,
  SettingsView,
  TokenResult,
  TokenState,
} from '../../shared/types';
import { normalizeError } from './errors';
import {
  ACCESS_TOKEN_KEY,
  deleteSetting,
  readAccessToken,
  readPreferences,
  writeAccessToken,
  writePreferences,
} from '../features/settings';
import {
  deleteRepositoryRow,
  findRepositoryByFullName,
  findRepositoryRow,
  insertRepositoryRow,
  listRepositoryRows,
  rowToGlance,
} from '../features/watchlist';
import { applyDetailValues, applyGlanceValues, fetchDetailValues, fetchGlanceValues } from '../features/fetching';

export interface FacadeDeps {
  db: Database.Database;
  github: GitHubPort;
  secrets: SecretBox;
  clock: Clock;
  logger?: Logger;
}

/**
 * 用例门面：渲染层唯一入口。清单增删与列举、轻量/全量抓取、令牌校验保存、设置读写。
 * 一切行为都在这里对外可见，测试只测这个边界。
 */
export function createFacade(deps: FacadeDeps): OctoFacade {
  const logger = deps.logger ?? silentLogger;
  const { db, github, secrets, clock } = deps;

  async function validateToken(token: string): Promise<TokenResult> {
    try {
      await github.validateToken(token);
      return { ok: true, error: null };
    } catch (error) {
      logger.error('令牌校验失败', error);
      return { ok: false, error: normalizeError(error) };
    }
  }

  function settingsView(): SettingsView {
    return {
      preferences: readPreferences(db),
      tokenConfigured: readAccessToken(db, secrets) !== null,
    };
  }

  return {
    tokenState(): Promise<TokenState> {
      return Promise.resolve({ configured: readAccessToken(db, secrets) !== null });
    },
    validateToken,
    async saveToken(token: string): Promise<TokenResult> {
      const result = await validateToken(token);
      if (!result.ok) return result;
      writeAccessToken(db, secrets, token);
      return { ok: true, error: null };
    },
    clearToken(): Promise<void> {
      deleteSetting(db, ACCESS_TOKEN_KEY);
      return Promise.resolve();
    },
    getSettings(): Promise<SettingsView> {
      return Promise.resolve(settingsView());
    },
    updateSettings(patch: Record<string, string>): Promise<SettingsView> {
      writePreferences(db, patch);
      return Promise.resolve(settingsView());
    },
    listRepositories(): Promise<Glance[]> {
      return Promise.resolve(listRepositoryRows(db).map(rowToGlance));
    },
    async addRepository(input: string): Promise<AddRepositoryResult> {
      const fullName = input.trim();
      const fail = (kind: 'token_invalid' | 'not_found' | 'unknown', message: string): AddRepositoryResult => ({
        ok: false,
        repository: null,
        error: { kind, message, fullName },
      });

      if (!/^[^\s/]+\/[^\s/]+$/.test(fullName)) {
        return fail('not_found', '仓库名格式应为 owner/repo');
      }
      if (findRepositoryByFullName(db, fullName)) {
        return fail('unknown', '该仓库已在监控清单中');
      }
      const token = readAccessToken(db, secrets);
      if (token === null) {
        return fail('token_invalid', '请先在设置页配置访问令牌');
      }

      try {
        // 先抓取验证（不存在/无权限/断网都不入列），成功才落库
        const values = await fetchGlanceValues(github, token, fullName);
        const [owner = '', name = ''] = fullName.split('/');
        const row = insertRepositoryRow(db, owner, name, clock.now().toISOString());
        const glance = applyGlanceValues(db, clock, row.id, values);
        return { ok: true, repository: glance, error: null };
      } catch (error) {
        logger.error(`加入监控清单失败：${fullName}`, error);
        return { ok: false, repository: null, error: normalizeError(error, fullName) };
      }
    },
    removeRepository(repositoryId: number): Promise<void> {
      deleteRepositoryRow(db, repositoryId);
      return Promise.resolve();
    },
    async refreshGlance(): Promise<RefreshGlanceResult> {
      const rows = listRepositoryRows(db);
      const errors: NormalizedError[] = [];
      const token = readAccessToken(db, secrets);
      if (token === null) {
        return {
          repositories: rows.map(rowToGlance),
          errors: [{ kind: 'token_invalid', message: '请先在设置页配置访问令牌' }],
        };
      }

      let aborted = false;
      for (const row of rows) {
        if (aborted) break;
        try {
          const values = await fetchGlanceValues(github, token, row.full_name);
          applyGlanceValues(db, clock, row.id, values);
        } catch (error) {
          const normalized = normalizeError(error, row.full_name);
          logger.error(`轻量信息抓取失败：${row.full_name}`, error);
          errors.push(normalized);
          // 令牌失效与限流会影响整个批次：中止余下抓取，避免连环报错
          if (normalized.kind === 'token_invalid' || normalized.kind === 'rate_limited') aborted = true;
        }
      }
      return { repositories: listRepositoryRows(db).map(rowToGlance), errors };
    },
    async fetchDetail(repositoryId: number): Promise<DetailResult> {
      const row = findRepositoryRow(db, repositoryId);
      if (!row) {
        return { detail: null, error: { kind: 'not_found', message: '监控仓库不存在' } };
      }
      const token = readAccessToken(db, secrets);
      if (token === null) {
        return {
          detail: null,
          error: { kind: 'token_invalid', message: '请先在设置页配置访问令牌', fullName: row.full_name },
        };
      }
      try {
        const values = await fetchDetailValues(github, token, row.full_name);
        return { detail: applyDetailValues(db, clock, repositoryId, values), error: null };
      } catch (error) {
        logger.error(`全量信息抓取失败：${row.full_name}`, error);
        return { detail: null, error: normalizeError(error, row.full_name) };
      }
    },
  };
}
