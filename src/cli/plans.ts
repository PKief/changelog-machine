import { resolve } from 'node:path';
import { renderMarkdown } from '../changelog/render.js';
import { mergeChangelog, parseChangelog } from '../changelog/update.js';
import { parseCommit } from '../commits/parse.js';
import { resolveContributors } from '../contributors/resolve.js';
import { getRepositoryUrl } from '../git/remote.js';
import type { Release } from '../types.js';
import { planVersion } from '../version/plan.js';
import type { FilePlan } from './files.js';
import type { Flags } from './options.js';
import { withProgress } from './progress.js';

export async function planBump(
  releases: Release[],
  cwd: string,
  latestTag?: string
): Promise<FilePlan[]> {
  const unreleased = releases.find((release) => release.tag === 'Unreleased');
  const plan = await planVersion(unreleased?.commits ?? [], latestTag, cwd);
  console.error(
    plan.next
      ? `${plan.current} → ${plan.next} (${plan.bump})`
      : `No version bump (${plan.current})`
  );
  return plan.files;
}

async function repositoryUrl(
  flags: Flags,
  cwd: string
): Promise<string | undefined> {
  const repository = flags['repo-url'] ?? (await getRepositoryUrl(cwd));
  if (repository) {
    const url = new URL(repository);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        '--repo-url must be an HTTPS repository URL without credentials, query or fragment'
      );
    }
  }
  return repository;
}

function changelogReleases(releases: Release[], flags: Flags): Release[] {
  return releases.filter((release) => {
    if (release.tag !== 'Unreleased') return true;
    return release.commits.some((commit) =>
      parseCommit(commit, flags['include-non-conventional'])
    );
  });
}

export function changelogPath(flags: Flags, cwd: string): string {
  const path = resolve(cwd, flags.output ?? 'CHANGELOG.md');
  if (
    ['package.json', 'package-lock.json', 'npm-shrinkwrap.json'].some(
      (name) => path === resolve(cwd, name)
    )
  ) {
    throw new Error('Changelog output must not overwrite package metadata');
  }
  return path;
}

export async function planChangelog(
  releases: Release[],
  flags: Flags,
  cwd: string,
  existing?: string
): Promise<FilePlan[]> {
  const selectedReleases = changelogReleases(releases, flags);
  const url = await repositoryUrl(flags, cwd);
  const commits = selectedReleases
    .flatMap((release) => release.commits)
    .filter((commit) => parseCommit(commit, flags['include-non-conventional']));
  const contributors = flags['resolve-contributors']
    ? await withProgress('Resolving contributor profiles', () =>
        resolveContributors(commits, url)
      )
    : undefined;
  const markdown = renderMarkdown(selectedReleases, {
    repositoryUrl: url,
    contributors,
    includeNonConventional: flags['include-non-conventional'],
  });
  const updated = mergeChangelog(
    existing === undefined ? undefined : parseChangelog(existing),
    markdown
  );
  if (flags['dry-run']) {
    process.stdout.write(updated);
    return [];
  }
  return updated === existing
    ? []
    : [{ path: changelogPath(flags, cwd), content: updated }];
}
