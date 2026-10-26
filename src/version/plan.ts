import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { recommendedBump } from '../commits/parse.js';
import type { Commit } from '../types.js';
import { formatJson, type JsonObject, parseObject } from './json.js';
import { readLockfiles, updateLockfile } from './lockfiles.js';

export interface VersionPlan {
  current: string;
  next?: string;
  bump?: 'major' | 'minor' | 'patch';
  files: { path: string; content: string }[];
}

const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const tagPrefixPattern = /^v/;

function readCurrentVersion(manifest: JsonObject): string {
  const current = manifest.version;
  if (typeof current !== 'string' || !stableVersionPattern.test(current)) {
    throw new Error(
      'package.json version must be stable semver (for example 1.2.3); prerelease and build versions are unsupported.'
    );
  }
  return current;
}

function validateLatestTag(
  latestTag: string | undefined,
  current: string
): void {
  if (
    latestTag !== undefined &&
    latestTag.replace(tagPrefixPattern, '') !== current
  ) {
    throw new Error(
      `Latest tag ${JSON.stringify(latestTag)} does not match package.json version ${current}. ` +
        'Tag the current release or restore package.json and its lockfile to the latest tagged version before retrying; refusing a repeated inferred bump.'
    );
  }
}

function bumpVersion(
  current: string,
  bump: NonNullable<VersionPlan['bump']>
): string {
  const parts = current.split('.').map((part) => BigInt(part));
  const bumpIndex = { major: 0, minor: 1, patch: 2 }[bump];
  parts[bumpIndex] += BigInt(1);
  for (let index = bumpIndex + 1; index < parts.length; index++)
    parts[index] = BigInt(0);
  return parts.join('.');
}

export async function planVersion(
  commits: Commit[],
  latestTag: string | undefined,
  cwd = process.cwd()
): Promise<VersionPlan> {
  const packagePath = resolve(cwd, 'package.json');
  const packageText = await readFile(packagePath, 'utf8');
  const manifest = parseObject(packageText, packagePath);
  const current = readCurrentVersion(manifest);
  validateLatestTag(latestTag, current);

  const bump = recommendedBump(commits);
  if (!bump) return { current, files: [] };

  const next = bumpVersion(current, bump);
  const lockfiles = await readLockfiles(cwd);
  const files = lockfiles.map(({ path, content }) => ({
    path,
    content: updateLockfile(path, content, next),
  }));
  manifest.version = next;
  files.unshift({
    path: packagePath,
    content: formatJson(manifest, packageText),
  });
  return { current, next, bump, files };
}
