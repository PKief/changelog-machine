import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseObject } from './json.js';

export const defaultBumpCommand =
  'npm version {version} --no-git-tag-version --ignore-scripts';

export function validateBumpCommand(command: string): void {
  if (!command.trim() || !command.includes('{version}')) {
    throw new Error('--bump-command must contain the {version} placeholder');
  }
}

export function formatBumpCommand(command: string, version: string): string {
  validateBumpCommand(command);
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error('Bump command requires a stable semver version');
  }
  return command.replaceAll('{version}', version);
}

/** Custom commands are explicitly trusted shell input, never read from Git. */
export async function runBumpCommand(
  version: string,
  cwd: string,
  command?: string
): Promise<void> {
  const formatted = formatBumpCommand(command ?? defaultBumpCommand, version);
  console.error(`Running bump command: ${formatted}`);
  await new Promise<void>((resolveCommand, reject) => {
    // Avoid shell interpretation for the built-in command.
    const child =
      command === undefined
        ? spawn(
            'npm',
            ['version', version, '--no-git-tag-version', '--ignore-scripts'],
            {
              cwd,
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: process.platform === 'win32',
            }
          )
        : spawn(formatted, {
            cwd,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
          });

    // Keep stdout reserved for changelog previews.
    child.stdout?.pipe(process.stderr, { end: false });
    child.stderr?.pipe(process.stderr, { end: false });
    child.on('error', (error) => {
      reject(
        new Error(
          `Could not start bump command: ${error.message}. Check repository files before retrying.`,
          { cause: error }
        )
      );
    });
    child.on('close', (code, signal) => {
      if (code === 0) resolveCommand();
      else
        reject(
          new Error(
            `Bump command failed (${signal ?? `exit ${code}`}). Repository files may have changed; inspect them before retrying.`
          )
        );
    });
  });
  const manifest = parseObject(
    await readFile(resolve(cwd, 'package.json'), 'utf8'),
    resolve(cwd, 'package.json')
  );
  if (manifest.version !== version) {
    throw new Error(
      `Bump command did not set package.json version to ${version} (found ${String(manifest.version)}). Repository files may have changed; inspect them before retrying.`
    );
  }
}
