export interface AuthorCommit {
  hash: string;
  name?: string;
  email?: string;
}

const validHash = /^[a-f\d]{7,64}$/i;

function authorIdentity(commit: AuthorCommit): string {
  if (commit.email?.trim()) return `email:${commit.email.trim().toLowerCase()}`;
  if (commit.name?.trim()) return `name:${commit.name.trim()}`;
  return `commit:${commit.hash}`;
}

export function groupAuthorCommits(
  commits: readonly AuthorCommit[]
): string[][] {
  const authors = new Map<string, Set<string>>();
  for (const commit of commits) {
    if (!validHash.test(commit.hash)) continue;
    const identity = authorIdentity(commit);
    const hashes = authors.get(identity) ?? new Set<string>();
    hashes.add(commit.hash);
    authors.set(identity, hashes);
  }
  return [...authors.values()].map((hashes) => [...hashes]);
}
