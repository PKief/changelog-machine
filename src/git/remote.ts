import { GitError, git } from './command.js';

const remoteWhitespace = /\s/;
const supportedRemoteUrlScheme = /^(https|ssh):\/\//i;
const scpStyleRemote = /^(?:[^@/:]+@)?([^/:]+):(.+)$/;
const surroundingPathSlashes = /^\/+|\/+$/g;
const gitPathSuffix = /\.git$/;
const repositoryPathWithAtLeastTwoSegments = /^[^/]+(?:\/[^/]+)+$/;
const queryOrFragmentMarker = /[?#]/;
const supportedRepositoryHosts = ['github.com', 'gitlab.com', 'bitbucket.org'];

async function readOriginRemote(cwd?: string): Promise<string | undefined> {
  try {
    return (await git(['config', '--get', 'remote.origin.url'], cwd)).trim();
  } catch (error) {
    if (error instanceof GitError && error.exitCode === 1) return undefined;
    throw error;
  }
}

function parseRemoteHostAndPath(
  remote: string
): { host: string; path: string } | undefined {
  if (supportedRemoteUrlScheme.test(remote)) {
    try {
      const url = new URL(remote);
      if (url.search || url.hash) return undefined;
      return { host: url.hostname.toLowerCase(), path: url.pathname };
    } catch {
      return undefined;
    }
  }
  const match = scpStyleRemote.exec(remote);
  if (!match) return undefined;
  const [, host, path] = match;
  return { host: host.toLowerCase(), path };
}

function isValidRepositoryPath(path: string): boolean {
  const hasTraversalSegment = path
    .split('/')
    .some((segment) => segment === '.' || segment === '..');
  return (
    repositoryPathWithAtLeastTwoSegments.test(path) &&
    !queryOrFragmentMarker.test(path) &&
    !hasTraversalSegment
  );
}

export async function getRepositoryUrl(
  cwd?: string
): Promise<string | undefined> {
  const remote = await readOriginRemote(cwd);
  if (!remote || remoteWhitespace.test(remote)) return undefined;

  const repository = parseRemoteHostAndPath(remote);
  if (!repository || !supportedRepositoryHosts.includes(repository.host))
    return undefined;

  const path = repository.path
    .replace(surroundingPathSlashes, '')
    .replace(gitPathSuffix, '');
  if (!isValidRepositoryPath(path)) return undefined;
  return `https://${repository.host}/${path}`;
}
