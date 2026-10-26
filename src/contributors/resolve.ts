import type { ContributorProfile } from './profile.js';
import { readBitbucketProfile, readGitHubProfile } from './profile.js';
import type { Repository } from './repository.js';
import {
  getCommitEndpoint,
  getRepositoryToken,
  parseRepository,
} from './repository.js';

export type { ContributorProfile } from './profile.js';

const REQUEST_TIMEOUT_MS = 5_000;
const MAX_CONCURRENT_REQUESTS = 3;
const validHash = /^[a-f\d]{7,64}$/i;

function readProfile(
  data: unknown,
  repository: Repository
): ContributorProfile | undefined {
  return repository.host === 'github.com'
    ? readGitHubProfile(data)
    : readBitbucketProfile(data);
}

async function requestProfile(
  repository: Repository,
  hash: string,
  token: string | undefined
): Promise<{ profile?: ContributorProfile; stop: boolean }> {
  try {
    const headers = new Headers({ accept: 'application/json' });
    if (token) headers.set('authorization', `Bearer ${token}`);
    const response = await fetch(getCommitEndpoint(repository, hash), {
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if ([401, 403, 429].includes(response.status)) return { stop: true };
    if (!response.ok) return { stop: false };
    return {
      profile: readProfile(await response.json(), repository),
      stop: false,
    };
  } catch {
    return { stop: false };
  }
}

export async function resolveContributors(
  commits: readonly { hash: string }[],
  repositoryUrl?: string
): Promise<Record<string, ContributorProfile>> {
  const repository = parseRepository(repositoryUrl);
  if (!repository) return {};

  const supportedRepository = repository;
  const hashes = [
    ...new Set(
      commits.map(({ hash }) => hash).filter((hash) => validHash.test(hash))
    ),
  ];
  const profiles: Record<string, ContributorProfile> = {};
  const token = getRepositoryToken(supportedRepository);
  let next = 0;
  let stopped = false;

  async function worker(): Promise<void> {
    while (!stopped) {
      const hash = hashes[next++];
      if (!hash) return;
      const result = await requestProfile(supportedRepository, hash, token);
      if (result.stop) stopped = true;
      if (result.profile) profiles[hash] = result.profile;
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_REQUESTS, hashes.length) },
      worker
    )
  );
  return profiles;
}
