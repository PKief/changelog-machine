import type { Release } from '../types.js';
import { readCommits } from './commits.js';
import {
  readGitMetadata,
  readTagsInHistory,
  resolveBoundary,
  validateTagChain,
} from './refs.js';

async function readReleaseRanges(
  tags: Awaited<ReturnType<typeof readTagsInHistory>>,
  cwd?: string,
  boundary?: { tag: string; hash: string }
): Promise<Release[]> {
  const releases: Release[] = [];
  for (let index = 0; index < tags.length; index++) {
    const current = tags[index];
    const previous =
      tags[index + 1] ?? (index === tags.length - 1 ? boundary : undefined);
    releases.push({
      tag: current.tag,
      ...(previous ? { previousTag: previous.tag } : {}),
      commits: await readCommits(
        previous ? `${previous.hash}..${current.hash}` : current.hash,
        cwd
      ),
    });
  }
  return releases;
}

export async function getLatestReleaseTag(
  cwd?: string
): Promise<string | undefined> {
  const metadata = await readGitMetadata(cwd);
  const tags = await readTagsInHistory(metadata, cwd, undefined, true);
  await validateTagChain(tags, cwd);
  return tags[0]?.tag;
}

export async function getReleases(
  cwd?: string,
  afterTag?: string
): Promise<Release[]> {
  const metadata = await readGitMetadata(cwd);
  const boundary =
    afterTag === undefined
      ? undefined
      : await resolveBoundary(afterTag, metadata, cwd);
  const tags = await readTagsInHistory(metadata, cwd, boundary);
  await validateTagChain(tags, cwd, boundary);
  const base = tags[0] ?? boundary;
  const hasUnreleasedRange = base ? metadata.head !== base.hash : true;
  const releases: Release[] =
    hasUnreleasedRange || afterTag !== undefined
      ? [
          {
            tag: 'Unreleased',
            ...(base ? { previousTag: base.tag } : {}),
            commits: await readCommits(
              base ? `${base.hash}..${metadata.head}` : metadata.head,
              cwd
            ),
          },
        ]
      : [];
  return [...releases, ...(await readReleaseRanges(tags, cwd, boundary))];
}
