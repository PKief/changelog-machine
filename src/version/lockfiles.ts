import { resolve } from 'node:path';
import { formatJson, isObject, parseObject, readOptionalFile } from './json.js';
import type { VersionPlan } from './plan.js';

export async function readLockfiles(
  cwd: string
): Promise<VersionPlan['files']> {
  const lockNames = [
    'package-lock.json',
    'npm-shrinkwrap.json',
    'pnpm-lock.yaml',
    'yarn.lock',
  ];
  const lockTexts = await Promise.all(
    lockNames.map((name) => readOptionalFile(resolve(cwd, name)))
  );
  if (lockTexts[0] !== undefined && lockTexts[1] !== undefined) {
    throw new Error(
      'Both package-lock.json and npm-shrinkwrap.json exist. Remove the unused lockfile to resolve ambiguity before bumping.'
    );
  }
  const unsupported = lockNames.filter(
    (_, index) => index >= 2 && lockTexts[index] !== undefined
  );
  if (unsupported.length) {
    throw new Error(
      `Unsupported lockfile: ${unsupported.join(', ')}. Update it with its package manager instead; only npm lockfiles are supported.`
    );
  }

  const files: VersionPlan['files'] = [];
  for (let index = 0; index < 2; index++) {
    const content = lockTexts[index];
    if (content !== undefined)
      files.push({ path: resolve(cwd, lockNames[index]), content });
  }
  return files;
}

export function updateLockfile(
  path: string,
  content: string,
  next: string
): string {
  const lockfile = parseObject(content, path);
  if (![1, 2, 3].includes(lockfile.lockfileVersion as number)) {
    throw new Error(
      `Unsupported lockfileVersion in ${path}; expected npm lockfile version 1, 2, or 3.`
    );
  }
  if (typeof lockfile.version !== 'string') {
    throw new Error(
      `Malformed ${path}: missing root version. Regenerate the lockfile with npm.`
    );
  }
  if (lockfile.packages !== undefined || lockfile.lockfileVersion !== 1) {
    if (
      !isObject(lockfile.packages) ||
      !isObject(lockfile.packages['']) ||
      typeof lockfile.packages[''].version !== 'string'
    ) {
      throw new Error(
        `Malformed ${path}: missing packages[''].version. Regenerate the lockfile with npm.`
      );
    }
    lockfile.packages[''].version = next;
  }
  lockfile.version = next;
  return formatJson(lockfile, content);
}
