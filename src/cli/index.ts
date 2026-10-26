import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseChangelog } from '../changelog/update.js';
import { getLatestReleaseTag, getReleases } from '../git/history.js';
import { apply } from './files.js';
import { parseFlags, showInformation, validateOptions } from './options.js';
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
  validateOptions(flags);
  const cwd = process.cwd();
  const writesChangelog = !flags.bump || flags.full;
  const existing =
    writesChangelog && !flags.full
      ? await readChangelog(changelogPath(flags, cwd))
      : undefined;
  const boundary =
    existing === undefined ? undefined : parseChangelog(existing).boundaryTag;
  const bumpBoundary =
    flags.bump && !writesChangelog
      ? await withProgress('Finding latest release', () =>
          getLatestReleaseTag(cwd)
        )
      : undefined;
  const releases = await withProgress('Reading Git releases', () =>
    getReleases(cwd, boundary ?? bumpBoundary)
  );
  const latestTag =
    releases.find((release) => release.tag !== 'Unreleased')?.tag ??
    releases.find((release) => release.tag === 'Unreleased')?.previousTag;
  const files = flags.bump ? await planBump(releases, cwd, latestTag) : [];
  if (writesChangelog)
    files.push(...(await planChangelog(releases, flags, cwd, existing)));
  if (!flags['dry-run']) await apply(files);
}
