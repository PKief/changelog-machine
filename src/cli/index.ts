import { readFile } from 'node:fs/promises';
import { parseChangelog } from '../changelog/update.js';
import { getLatestReleaseTag, getReleases } from '../git/history.js';
import type { Release } from '../types.js';
import {
  defaultBumpCommand,
  formatBumpCommand,
  runBumpCommand,
} from '../version/command.js';
import type { VersionPlan } from '../version/plan.js';
import { apply, type FilePlan } from './files.js';
import { type Flags, parseFlags, showInformation } from './options.js';
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

async function readExistingChangelog(flags: Flags, cwd: string) {
  const existing = flags.full
    ? undefined
    : await readChangelog(changelogPath(flags, cwd));
  // Only regenerate history newer than the latest documented release.
  const boundary =
    existing === undefined ? undefined : parseChangelog(existing).boundaryTag;
  return { existing, boundary };
}

async function prepareBump(
  flags: Flags,
  cwd: string
): Promise<VersionPlan | undefined> {
  if (!flags.bump) return undefined;
  const tag = await getLatestReleaseTag(cwd);
  return planBump(await getReleases(cwd, tag), cwd, tag);
}

function promoteUnreleased(
  releases: Release[],
  next: string | undefined,
  boundary: string | undefined
): Release[] {
  if (!next) return releases;
  // Incremental history may expose the previous tag only through Unreleased.
  const latestTag =
    releases.find((release) => release.tag !== 'Unreleased')?.tag ??
    releases.find((release) => release.tag === 'Unreleased')?.previousTag ??
    boundary;
  return releases.map((release) =>
    release.tag === 'Unreleased'
      ? { ...release, tag: `v${next}`, previousTag: latestTag }
      : release
  );
}

async function prepareFiles(
  flags: Flags,
  cwd: string,
  existing: string | undefined,
  boundary: string | undefined,
  bump: VersionPlan | undefined
): Promise<FilePlan[]> {
  const releases = await withProgress('Reading Git releases', () =>
    getReleases(cwd, boundary)
  );
  return [
    ...(bump?.files ?? []),
    ...(await planChangelog(
      promoteUnreleased(releases, bump?.next, boundary),
      flags,
      cwd,
      existing
    )),
  ];
}

async function applyOrPreview(
  files: FilePlan[],
  flags: Flags,
  cwd: string,
  next: string | undefined
): Promise<void> {
  if (flags['dry-run']) {
    if (next) {
      console.error(
        `Would run: ${formatBumpCommand(flags['bump-command'] ?? defaultBumpCommand, next)}`
      );
    }
    return;
  }
  // Stage the changelog first; update metadata before replacing it.
  await apply(
    files,
    next ? () => runBumpCommand(next, cwd, flags['bump-command']) : undefined
  );
}

export async function run(args = process.argv.slice(2)): Promise<void> {
  const flags = parseFlags(args);
  if (await showInformation(flags)) return;
  const cwd = process.cwd();
  const { existing, boundary } = await readExistingChangelog(flags, cwd);
  const bump = await prepareBump(flags, cwd);
  if (flags.bump && !bump?.next) return;
  const files = await prepareFiles(flags, cwd, existing, boundary, bump);
  await applyOrPreview(files, flags, cwd, bump?.next);
}
