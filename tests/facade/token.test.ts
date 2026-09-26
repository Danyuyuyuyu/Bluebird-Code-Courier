import { describe, it, expect, afterEach } from 'vitest';
import { createHarness, type Harness } from '../helpers/harness';
import { fixtures } from '../helpers/fake-github';

let harness: Harness | null = null;

function h(): Harness {
  if (!harness) throw new Error('harness not created');
  return harness;
}

afterEach(() => {
  harness?.destroy();
  harness = null;
});

describe('访问令牌校验与保存', () => {
  it('有效令牌校验保存成功，并以密文落库', async () => {
    harness = createHarness();

    const result = await h().facade.saveToken('ghp_valid_token');
    expect(result).toEqual({ ok: true, error: null });
    expect(await h().facade.tokenState()).toEqual({ configured: true });

    const row = h()
      .db.prepare("SELECT value FROM setting WHERE key = 'access_token'")
      .get() as { value: string };
    expect(row.value).not.toContain('ghp_valid_token');
    expect(h().secrets.decrypt(row.value)).toBe('ghp_valid_token');
  });

  it('无效令牌（401）报令牌无效且不落库', async () => {
    harness = createHarness();

    const result = await h().facade.saveToken('ghp_bad');
    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ kind: 'token_invalid' });
    expect(await h().facade.tokenState()).toEqual({ configured: false });

    const row = h().db.prepare("SELECT value FROM setting WHERE key = 'access_token'").get();
    expect(row).toBeUndefined();
  });

  it('校验时网络失败报网络失败且不落库', async () => {
    harness = createHarness();
    h().github.networkDown = true;

    const result = await h().facade.saveToken('ghp_valid_token');
    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ kind: 'network' });
    expect(await h().facade.tokenState()).toEqual({ configured: false });
  });

  it('validateToken 只校验不落库', async () => {
    harness = createHarness();

    expect(await h().facade.validateToken('ghp_valid_token')).toEqual({ ok: true, error: null });
    expect(await h().facade.tokenState()).toEqual({ configured: false });

    h().github.fail('*', 'validateToken', fixtures.unauthorized());
    const bad = await h().facade.validateToken('whatever');
    expect(bad.ok).toBe(false);
    expect(bad.error).toMatchObject({ kind: 'token_invalid' });
  });

  it('清除令牌后回到未配置', async () => {
    harness = createHarness();
    await h().facade.saveToken('ghp_valid_token');

    await h().facade.clearToken();
    expect(await h().facade.tokenState()).toEqual({ configured: false });
    const row = h().db.prepare("SELECT value FROM setting WHERE key = 'access_token'").get();
    expect(row).toBeUndefined();
  });
});
