import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { promisify } from 'node:util';
import { getRepositoryUrl } from './remote.js';

const execFileAsync = promisify(execFile);

async function runGit(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout;
}

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true }))
  );
});

async function repository(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'changelog-git-'));
  directories.push(cwd);
  await runGit(['init', '--initial-branch=main'], cwd);
  await runGit(['config', 'user.name', 'Original Author'], cwd);
  await runGit(['config', 'user.email', 'original@example.com'], cwd);
  await runGit(['config', 'commit.gpgsign', 'false'], cwd);
  await runGit(['config', 'tag.gpgsign', 'false'], cwd);
  return cwd;
}

test('normalizes supported origin URLs and ignores missing/unsupported origins', async () => {
  const cwd = await repository();
  assert.equal(await getRepositoryUrl(cwd), undefined);
  const cases: [string, string | undefined][] = [
    ['https://github.com/owner/repo.git', 'https://github.com/owner/repo'],
    [
      'https://user:secret@github.com/owner/repo.git/',
      'https://github.com/owner/repo',
    ],
    ['git@github.com:owner/repo.git', 'https://github.com/owner/repo'],
    [
      'ssh://git@gitlab.com:2222/group/subgroup/repo.git',
      'https://gitlab.com/group/subgroup/repo',
    ],
    ['git@bitbucket.org:owner/repo.git', 'https://bitbucket.org/owner/repo'],
    ['https://gitlab.com/group/repo', 'https://gitlab.com/group/repo'],
    [
      'ssh://git@bitbucket.org/owner/repo.git',
      'https://bitbucket.org/owner/repo',
    ],
    ['https://example.com/owner/repo.git', undefined],
    ['http://github.com/owner/repo.git', undefined],
    ['/local/repository', undefined],
    ['https://github.com/owner/repo?token=secret', undefined],
    ['garbage', undefined],
  ];
  for (const [remote, expected] of cases) {
    await runGit(['config', 'remote.origin.url', remote], cwd);
    assert.equal(await getRepositoryUrl(cwd), expected, remote);
  }
});
