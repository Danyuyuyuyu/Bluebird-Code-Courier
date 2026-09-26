import { describe, it, expect, afterEach } from 'vitest';
import { createHarness, type Harness } from '../helpers/harness';
import { makeRepoData } from '../helpers/fake-github';

let harness: Harness | null = null;

function h(): Harness {
  if (!harness) throw new Error('harness not created');
  return harness;
}

afterEach(() => {
  harness?.destroy();
  harness = null;
});

async function ready(): Promise<Harness> {
  harness = createHarness();
  await h().facade.saveToken('ghp_valid_token');
  return h();
}

describe('监控清单', () => {
  it('加入清单：立即抓取轻量信息并落库，同时记一档历史快照', async () => {
    await ready();
    h().github.addRepo(makeRepoData());

    const result = await h().facade.addRepository('octo-demo/hello-world');
    expect(result.ok).toBe(true);
    expect(result.repository).toMatchObject({
      owner: 'octo-demo',
      name: 'hello-world',
      fullName: 'octo-demo/hello-world',
      stars: 1284,
      forks: 96,
      openIssues: 23,
      pushedAt: '2026-09-25T08:30:00.000Z',
      latestReleaseTag: 'v2.4.0',
      fetchedAt: h().clock.now().toISOString(),
    });

    const row = h()
      .db.prepare("SELECT * FROM repository WHERE full_name = 'octo-demo/hello-world'")
      .get() as Record<string, unknown>;
    expect(row).toMatchObject({ owner: 'octo-demo', name: 'hello-world', stars: 1284, latest_release_tag: 'v2.4.0' });

    const snapshot = h().db.prepare('SELECT * FROM snapshot').get() as Record<string, unknown>;
    expect(snapshot).toMatchObject({
      stars: 1284,
      forks: 96,
      open_issues: 23,
      latest_release_tag: 'v2.4.0',
      day: '2026-09-26',
    });
  });

  it('列举返回轻量信息（star、最近动态时间、最新发版标签）', async () => {
    await ready();
    h().github.addRepo(makeRepoData());
    await h().facade.addRepository('octo-demo/hello-world');

    const listed = await h().facade.listRepositories();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      fullName: 'octo-demo/hello-world',
      stars: 1284,
      pushedAt: '2026-09-25T08:30:00.000Z',
      latestReleaseTag: 'v2.4.0',
    });
  });

  it('加入不存在或无权访问的仓库（404）立即报错且不留在清单里', async () => {
    await ready();

    const result = await h().facade.addRepository('octo-demo/ghost');
    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ kind: 'not_found', fullName: 'octo-demo/ghost' });
    expect(await h().facade.listRepositories()).toEqual([]);
    const row = h().db.prepare('SELECT COUNT(*) AS n FROM repository').get() as { n: number };
    expect(row.n).toBe(0);
  });

  it('加入时网络失败也不把坏条目留在清单里', async () => {
    await ready();
    h().github.networkDown = true;

    const result = await h().facade.addRepository('octo-demo/hello-world');
    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ kind: 'network' });
    expect(await h().facade.listRepositories()).toEqual([]);
  });

  it('非法仓库名给出明确报错（owner/repo 格式）', async () => {
    await ready();

    const result = await h().facade.addRepository('not-a-repo');
    expect(result.ok).toBe(false);
    expect(result.error?.kind).toBe('not_found');
    expect(result.error?.message).toContain('owner/repo');
  });

  it('重复加入同一仓库报错，清单不重复', async () => {
    await ready();
    h().github.addRepo(makeRepoData());
    await h().facade.addRepository('octo-demo/hello-world');

    const again = await h().facade.addRepository('octo-demo/hello-world');
    expect(again.ok).toBe(false);
    expect(await h().facade.listRepositories()).toHaveLength(1);
  });

  it('从清单删除监控仓库', async () => {
    await ready();
    h().github.addRepo(makeRepoData());
    const added = await h().facade.addRepository('octo-demo/hello-world');

    await h().facade.removeRepository(added.repository!.id);
    expect(await h().facade.listRepositories()).toEqual([]);
  });

  it('清单关闭重开后依然存在（持久化）', async () => {
    await ready();
    h().github.addRepo(makeRepoData());
    await h().facade.addRepository('octo-demo/hello-world');

    const reopened = h().reopen();
    const listed = await reopened.facade.listRepositories();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ fullName: 'octo-demo/hello-world', stars: 1284 });
    expect(await reopened.facade.tokenState()).toEqual({ configured: true });
  });
});
