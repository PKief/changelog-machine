export interface Repository {
  host: 'github.com' | 'bitbucket.org';
  path: string;
}

export function parseRepository(
  repositoryUrl?: string
): Repository | undefined {
  if (!repositoryUrl) return undefined;
  try {
    const url = new URL(repositoryUrl);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    )
      return undefined;
    const host = url.hostname.toLowerCase();
    if (host !== 'github.com' && host !== 'bitbucket.org') return undefined;
    const path = url.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '');
    const segments = path.split('/');
    if (
      segments.length !== 2 ||
      segments.some(
        (part) => !/^[a-z\d_.-]+$/i.test(part) || part === '.' || part === '..'
      )
    )
      return undefined;
    return { host, path };
  } catch {
    return undefined;
  }
}

export function getCommitEndpoint(
  repository: Repository,
  hash: string
): string {
  return repository.host === 'github.com'
    ? `https://api.github.com/repos/${repository.path}/commits/${hash}`
    : `https://api.bitbucket.org/2.0/repositories/${repository.path}/commit/${hash}`;
}

export function getRepositoryToken(repository: Repository): string | undefined {
  return repository.host === 'github.com'
    ? process.env.GH_TOKEN || process.env.GITHUB_TOKEN
    : process.env.BITBUCKET_TOKEN;
}
