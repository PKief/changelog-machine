import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { resolveContributors } from './resolve.js';

const fetchMock = mock.method(
  globalThis,
  'fetch',
  async () => new Response('{}')
);
const previousTokens = {
  gh: process.env.GH_TOKEN,
  github: process.env.GITHUB_TOKEN,
  bitbucket: process.env.BITBUCKET_TOKEN,
};

afterEach(() => {
  fetchMock.mock.resetCalls();
  process.env.GH_TOKEN = previousTokens.gh;
  process.env.GITHUB_TOKEN = previousTokens.github;
  process.env.BITBUCKET_TOKEN = previousTokens.bitbucket;
});

function setFetch(handler: typeof fetch): void {
  fetchMock.mock.mockImplementation(handler);
}

const githubProfile = JSON.parse(
  '{"author":{"login":"alice","html_url":"https://github.com/alice"}}'
);
const invalidGithubProfile = JSON.parse(
  '{"author":{"login":"person@example.com","html_url":"https://github.com/person"}}'
);
const bitbucketProfiles = [
  JSON.parse(
    '{"author":{"user":{"nickname":"bob","display_name":"Bob Jones","links":{"html":{"href":"https://bitbucket.org/bob"}}}}}'
  ),
  JSON.parse(
    '{"author":{"user":{"display_name":"Carol Smith","links":{"html":{"href":"https://bitbucket.org/carol"}}}}}'
  ),
];

test('resolves GitHub profiles and sends the configured bearer token', async () => {
  process.env.GH_TOKEN = 'github-secret';
  process.env.GITHUB_TOKEN = '';
  setFetch(async (input, init) => {
    assert.equal(
      String(input),
      'https://api.github.com/repos/org/repo/commits/abcdef1'
    );
    assert.equal(
      new Headers(init?.headers).get('authorization'),
      'Bearer github-secret'
    );
    assert.equal(init?.redirect, 'error');
    return Response.json(githubProfile);
  });

  assert.deepEqual(
    await resolveContributors(
      [{ hash: 'abcdef1' }],
      'https://github.com/org/repo.git'
    ),
    {
      abcdef1: { username: 'alice', url: 'https://github.com/alice' },
    }
  );
});

test('resolves Bitbucket nickname and falls back to display name', async () => {
  process.env.BITBUCKET_TOKEN = 'bitbucket-secret';
  let call = 0;
  setFetch(async (_input, init) => {
    assert.equal(
      new Headers(init?.headers).get('authorization'),
      'Bearer bitbucket-secret'
    );
    call++;
    const user =
      call === 1
        ? bitbucketProfiles[0].author.user
        : bitbucketProfiles[1].author.user;
    return Response.json({ author: { user } });
  });

  const result = await resolveContributors(
    [{ hash: 'abcdef1' }, { hash: 'abcdef2' }],
    'https://bitbucket.org/team/repo'
  );
  assert.deepEqual(result, {
    abcdef1: { username: 'bob', url: 'https://bitbucket.org/bob' },
    abcdef2: { username: 'Carol Smith', url: 'https://bitbucket.org/carol' },
  });
});

test('GitLab, unsupported remotes, and malformed hashes make no requests', async () => {
  setFetch(async () => {
    throw new Error('unexpected request');
  });
  const commits = [
    { hash: 'abcdef1' },
    { hash: '../abcdef' },
    { hash: 'nope' },
  ];
  assert.deepEqual(
    await resolveContributors(commits, 'https://gitlab.com/group/repo'),
    {}
  );
  assert.deepEqual(
    await resolveContributors(commits, 'https://example.com/org/repo'),
    {}
  );
  assert.deepEqual(
    await resolveContributors(commits, 'http://github.com/org/repo'),
    {}
  );
  assert.deepEqual(
    await resolveContributors(commits, 'https://user:pass@github.com/org/repo'),
    {}
  );
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('deduplicates commits and omits invalid API profiles and request failures', async () => {
  let callCount = 0;
  setFetch(async (input) => {
    callCount++;
    if (String(input).endsWith('/abcdef2')) throw new Error('offline');
    return Response.json(invalidGithubProfile);
  });
  const commits = [
    { hash: 'abcdef1' },
    { hash: 'abcdef1' },
    { hash: 'abcdef2' },
  ];
  assert.deepEqual(
    await resolveContributors(commits, 'https://github.com/org/repo'),
    {}
  );
  assert.equal(callCount, 2);
});

test('stops scheduling queued requests after a rate limit response', async () => {
  const requested: string[] = [];
  let releaseRateLimit: (() => void) | undefined;
  const rateLimit = new Promise<void>((resolve) => {
    releaseRateLimit = resolve;
  });
  let releaseOtherRequests: (() => void) | undefined;
  const otherRequests = new Promise<void>((resolve) => {
    releaseOtherRequests = resolve;
  });
  setFetch(async (input) => {
    const endpoint = String(input);
    requested.push(endpoint);
    if (endpoint.endsWith('/abcdef1')) {
      await rateLimit;
      return new Response('', { status: 429 });
    }
    await otherRequests;
    return Response.json(githubProfile);
  });
  const resolving = resolveContributors(
    ['abcdef1', 'abcdef2', 'abcdef3', 'abcdef4', 'abcdef5'].map((hash) => ({
      hash,
    })),
    'https://github.com/org/repo'
  );
  await new Promise((resolve) => setImmediate(resolve));
  releaseRateLimit?.();
  await new Promise((resolve) => setImmediate(resolve));
  releaseOtherRequests?.();
  await resolving;
  assert.equal(requested.length, 3);
});
