import type { AuthorCommit } from './authors.js';
import { groupAuthorCommits } from './authors.js';
import type { ContributorProfile } from './profile.js';
import { readBitbucketProfile, readGitHubProfile } from './profile.js';
import type { Repository } from './repository.js';
import {
  getCommitEndpoint,
  getRepositoryToken,
  parseRepository,
} from './repository.js';

export type { ContributorProfile } from './profile.js';

export interface ContributorProgress {
  completed: number;
  total: number;
  resolved: number;
  requests: number;
}

const REQUEST_TIMEOUT_MS = 5_000;
const MAX_CONCURRENT_REQUESTS = 3;
const MAX_ATTEMPTS_PER_AUTHOR = 2;

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
  commits: readonly AuthorCommit[],
  repositoryUrl?: string,
  onProgress?: (progress: ContributorProgress) => void
): Promise<Record<string, ContributorProfile>> {
  const repository = parseRepository(repositoryUrl);
  if (!repository) return {};

  const supportedRepository = repository;
  const authors = groupAuthorCommits(commits);
  const profiles: Record<string, ContributorProfile> = {};
  const token = getRepositoryToken(repository);
  let next = 0;
  let stopped = false;
  const progress = {
    completed: 0,
    total: authors.length,
    resolved: 0,
    requests: 0,
  };
  const report = () => onProgress?.({ ...progress });
  report();

  async function resolveAuthor(hashes: string[]): Promise<void> {
    for (const hash of hashes.slice(0, MAX_ATTEMPTS_PER_AUTHOR)) {
      if (stopped) return;
      progress.requests++;
      report();
      const result = await requestProfile(supportedRepository, hash, token);
      if (result.stop) {
        if (!stopped)
          console.error(
            'Contributor lookup stopped: authentication failed or API rate limit reached. Using Git author names for unresolved contributors.'
          );
        stopped = true;
        return;
      }
      if (result.profile) {
        progress.resolved++;
        for (const authorHash of hashes) profiles[authorHash] = result.profile;
        return;
      }
    }
  }

  async function worker(): Promise<void> {
    while (!stopped) {
      const hashes = authors[next++];
      if (!hashes) return;
      await resolveAuthor(hashes);
      progress.completed++;
      report();
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_REQUESTS, authors.length) },
      worker
    )
  );
  return profiles;
}
