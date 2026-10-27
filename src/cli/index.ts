import { readFile } from 'node:fs/promises';
import { parseChangelog } from '../changelog/update.js';
import { getLatestReleaseTag, getReleases } from '../git/history.js';
import { apply } from './files.js';
import { parseFlags, showInformation } from './options.js';
import { changelogPath, planBump, planChangelog } from './plans.js';
import { withProgress } from './progress.js';

async function readChangelog(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

export async function run(args = process.argv.slice(2)): Promise<void> {
  const flags = parseFlags(args);
  if (await showInformation(flags)) return;
  const cwd = process.cwd();
  const existing = flags.full
    ? undefined
    : await readChangelog(changelogPath(flags, cwd));
  const boundary =
    existing === undefined ? undefined : parseChangelog(existing).boundaryTag;
  const bumpTag = flags.bump ? await getLatestReleaseTag(cwd) : undefined;
  const bump = flags.bump
    ? await planBump(await getReleases(cwd, bumpTag), cwd, bumpTag)
    : undefined;
  if (flags.bump && !bump?.next) return;
  let releases = await withProgress('Reading Git releases', () =>
    getReleases(cwd, boundary)
  );
  const latestTag =
    releases.find((release) => release.tag !== 'Unreleased')?.tag ??
    releases.find((release) => release.tag === 'Unreleased')?.previousTag ??
    boundary;
  if (bump?.next) {
    releases = releases.map((release) =>
      release.tag === 'Unreleased'
        ? { ...release, tag: `v${bump.next}`, previousTag: latestTag }
        : release
    );
  }
  const files = [
    ...(bump?.files ?? []),
    ...(await planChangelog(releases, flags, cwd, existing)),
  ];
  if (!flags['dry-run']) await apply(files);
}
