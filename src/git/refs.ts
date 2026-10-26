import { GitError, git } from './command.js';
import { isVersionTag } from './tags.js';

export type VersionTag = { tag: string; hash: string };
export type GitMetadata = {
  head: string;
  tagsByHash: Map<string, string[]>;
};

async function requireFullHistory(cwd?: string): Promise<void> {
  if (
    (await git(['rev-parse', '--is-shallow-repository'], cwd)).trim() === 'true'
  ) {
    throw new Error(
      'Cannot generate releases from a shallow repository. Fetch the full history with git fetch --unshallow (including tags), then retry.'
    );
  }
}

async function readTagRefs(cwd?: string): Promise<Map<string, string[]>> {
  const output = await git(
    [
      'for-each-ref',
      '--format=%(refname:strip=2)%00%(objecttype)%00%(objectname)%00%(*objectname)%00',
      'refs/tags/',
    ],
    cwd
  );
  const tagsByHash = new Map<string, string[]>();
  const fields = output.split('\0');
  if (fields.at(-1) === '') fields.pop();
  for (let index = 0; index + 3 < fields.length; index += 4) {
    const [rawTag, rawType, rawObjectHash, rawPeeledHash] = fields.slice(
      index,
      index + 4
    );
    const tag = rawTag.trim();
    const type = rawType.trim();
    const hash = type === 'tag' ? rawPeeledHash.trim() : rawObjectHash.trim();
    if (!tag || !hash || !isVersionTag(tag)) continue;
    const names = tagsByHash.get(hash) ?? [];
    names.push(tag);
    tagsByHash.set(hash, names);
  }
  return tagsByHash;
}

export async function readGitMetadata(cwd?: string): Promise<GitMetadata> {
  await requireFullHistory(cwd);
  const [head, tagsByHash] = await Promise.all([
    git(['rev-parse', '--verify', 'HEAD^{commit}'], cwd).then((value) =>
      value.trim()
    ),
    readTagRefs(cwd),
  ]);
  return { head, tagsByHash };
}

async function isAncestor(
  older: string,
  newer: string,
  cwd?: string
): Promise<boolean> {
  try {
    await git(['merge-base', '--is-ancestor', older, newer], cwd);
    return true;
  } catch (error) {
    if (error instanceof GitError && error.exitCode === 1) return false;
    throw error;
  }
}

export async function resolveBoundary(
  afterTag: string,
  metadata: GitMetadata,
  cwd?: string
): Promise<VersionTag> {
  if (!isVersionTag(afterTag))
    throw new Error(`Invalid version tag: ${afterTag}`);
  const found = [...metadata.tagsByHash].find(([, names]) =>
    names.includes(afterTag)
  );
  if (!found) throw new Error(`Release boundary tag not found: ${afterTag}`);
  const boundary = { tag: afterTag, hash: found[0] };
  if (!(await isAncestor(boundary.hash, metadata.head, cwd))) {
    throw new Error(
      `Release boundary tag is not reachable from HEAD: ${afterTag}`
    );
  }
  return boundary;
}

export async function readTagsInHistory(
  metadata: GitMetadata,
  cwd?: string,
  boundary?: VersionTag,
  decoratedOnly = false
): Promise<VersionTag[]> {
  const args = ['rev-list', '--topo-order'];
  if (decoratedOnly) args.push('--simplify-by-decoration');
  args.push(metadata.head);
  if (boundary) args.push(`^${boundary.hash}`);
  const output = await git(args, cwd);
  const tags: VersionTag[] = [];
  const encountered = new Set<string>();
  const hashes = output.trim().split('\n');
  if (boundary) hashes.push(boundary.hash);
  for (const hash of hashes) {
    if (!hash || encountered.has(hash)) continue;
    encountered.add(hash);
    const names = metadata.tagsByHash.get(hash);
    if (!names?.length) continue;
    if (names.length > 1) {
      throw new Error(
        `Ambiguous release tags point to the same commit: ${names.join(', ')}.`
      );
    }
    if (hash !== boundary?.hash) tags.push({ tag: names[0], hash });
  }
  return tags;
}

export async function validateTagChain(
  tags: VersionTag[],
  cwd?: string,
  boundary?: VersionTag
): Promise<void> {
  for (let index = 1; index < tags.length; index++) {
    if (!(await isAncestor(tags[index].hash, tags[index - 1].hash, cwd))) {
      throw new Error(
        `Ambiguous release tags: ${tags[index - 1].tag} and ${tags[index].tag} are not ancestors of one another. Release tags must form a single ancestry chain.`
      );
    }
  }
  if (
    boundary &&
    tags.length &&
    !(await isAncestor(boundary.hash, tags.at(-1)!.hash, cwd))
  ) {
    throw new Error(
      `Ambiguous release tags: ${boundary.tag} and ${tags.at(-1)!.tag} are not ancestors of one another. Release tags must form a single ancestry chain.`
    );
  }
}
