import type { CommitItem, ReleaseItem } from '../../src/shared/types';
import { GitHubRequestError } from '../../src/main/core/github/port';
import type { BuildRun, GitHubPort, IssueOrPullRequest, RepoMeta } from '../../src/main/core/github/port';

/** 录制形态的仓库数据（按抓取与 API 调用清单组织）。 */
export interface FakeRepoData {
  meta: RepoMeta;
  latestRelease: ReleaseItem | null;
  releases: ReleaseItem[];
  commits: CommitItem[];
  issuesAndPullRequests: IssueOrPullRequest[];
  build: BuildRun | null;
}

export type FakeMethod = 'validateToken' | keyof Omit<GitHubPort, 'validateToken'>;

/** 按 spec 的错误与降级场景构造的适配器错误。 */
export const fixtures = {
  unauthorized(): GitHubRequestError {
    return new GitHubRequestError(401, {}, 'Bad credentials');
  },
  rateLimited(resetAt: Date): GitHubRequestError {
    const headers: Record<string, string> = {
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(Math.floor(resetAt.getTime() / 1000)),
    };
    return new GitHubRequestError(403, headers, 'API rate limit exceeded');
  },
  notFound(): GitHubRequestError {
    return new GitHubRequestError(404, {}, 'Not Found');
  },
  networkError(): TypeError {
    return new TypeError('fetch failed');
  },
  unknownError(): Error {
    return new Error('unexpected payload');
  },
};

export function makeRepoData(overrides: Partial<FakeRepoData> = {}): FakeRepoData {
  return {
    meta: {
      fullName: 'octo-demo/hello-world',
      stars: 1284,
      forks: 96,
      openIssues: 23,
      pushedAt: '2026-09-25T08:30:00.000Z',
    },
    latestRelease: {
      tagName: 'v2.4.0',
      title: 'v2.4.0 — 稳定性修复',
      publishedAt: '2026-09-20T12:00:00.000Z',
    },
    releases: [
      { tagName: 'v2.4.0', title: 'v2.4.0 — 稳定性修复', publishedAt: '2026-09-20T12:00:00.000Z' },
      { tagName: 'v2.3.1', title: 'v2.3.1 — 补丁', publishedAt: '2026-08-11T09:00:00.000Z' },
    ],
    commits: [
      {
        sha: 'a1b2c3d',
        message: '修复快照当日重复记档',
        authorName: 'octo-dev',
        committedAt: '2026-09-25T08:30:00.000Z',
      },
      {
        sha: 'e4f5a6b',
        message: '补充限流错误归一',
        authorName: 'octo-dev',
        committedAt: '2026-09-24T15:10:00.000Z',
      },
    ],
    issuesAndPullRequests: [
      { number: 42, title: '清单页刷新按钮无反馈', state: 'open', authorName: 'user-a', updatedAt: '2026-09-25T02:00:00.000Z', hasPullRequest: false },
      { number: 57, title: 'feat: 详情页构建徽章', state: 'open', authorName: 'user-b', updatedAt: '2026-09-25T07:20:00.000Z', hasPullRequest: true },
    ],
    build: {
      workflowName: 'ci',
      status: 'completed',
      conclusion: 'success',
      url: 'https://github.com/octo-demo/hello-world/actions/runs/1',
      finishedAt: '2026-09-25T08:45:00.000Z',
    },
    ...overrides,
  };
}

/**
 * 假 GitHub 适配器：以录制的 fixtures 应答，
 * 并可按仓库 + 方法注入限流 / 401 / 404 / 网络失败场景。
 */
export class FakeGitHub implements GitHubPort {
  validToken = 'ghp_valid_token';
  /** 抓取过程中令牌失效（401）。 */
  tokenInvalid = false;
  /** 全局断网。 */
  networkDown = false;
  repos = new Map<string, FakeRepoData>();
  /** 按 fullName（'*' 表示所有仓库）+ 方法注入的错误。 */
  failures = new Map<string, Partial<Record<FakeMethod, unknown>>>();

  addRepo(data: FakeRepoData): FakeRepoData {
    this.repos.set(data.meta.fullName, data);
    return data;
  }

  fail(fullName: string, method: FakeMethod, error: unknown): void {
    const perRepo = this.failures.get(fullName) ?? {};
    perRepo[method] = error;
    this.failures.set(fullName, perRepo);
  }

  private guard(fullName: string, method: FakeMethod): void {
    const scoped = this.failures.get(fullName)?.[method] ?? this.failures.get('*')?.[method];
    if (scoped) throw scoped;
    if (this.networkDown) throw fixtures.networkError();
    if (this.tokenInvalid) throw fixtures.unauthorized();
  }

  private repo(fullName: string): FakeRepoData {
    const data = this.repos.get(fullName);
    if (!data) throw fixtures.notFound();
    return data;
  }

  async validateToken(token: string): Promise<void> {
    this.guard('*', 'validateToken');
    if (token !== this.validToken) throw fixtures.unauthorized();
  }

  async getRepositoryMeta(_token: string, fullName: string): Promise<RepoMeta> {
    this.guard(fullName, 'getRepositoryMeta');
    return this.repo(fullName).meta;
  }

  async getLatestRelease(_token: string, fullName: string): Promise<ReleaseItem | null> {
    this.guard(fullName, 'getLatestRelease');
    return this.repo(fullName).latestRelease;
  }

  async listReleases(_token: string, fullName: string): Promise<ReleaseItem[]> {
    this.guard(fullName, 'listReleases');
    return this.repo(fullName).releases;
  }

  async listCommits(_token: string, fullName: string): Promise<CommitItem[]> {
    this.guard(fullName, 'listCommits');
    return this.repo(fullName).commits;
  }

  async listIssues(_token: string, fullName: string): Promise<IssueOrPullRequest[]> {
    this.guard(fullName, 'listIssues');
    return this.repo(fullName).issuesAndPullRequests;
  }

  async getLatestBuild(_token: string, fullName: string): Promise<BuildRun | null> {
    this.guard(fullName, 'getLatestBuild');
    return this.repo(fullName).build;
  }
}
