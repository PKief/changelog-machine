import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { promisify } from 'node:util';
import { GitError, git } from './command.js';

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

test('git runs a command and preserves stdout', async () => {
  assert.match(await git(['--version']), /^git version .+\n$/);
  const cwd = await repository();
  assert.equal(
    await git(['rev-parse', '--is-inside-work-tree'], cwd),
    'true\n'
  );
});

test('git passes arguments literally without invoking a shell', async () => {
  const cwd = await repository();
  await git(
    ['config', 'test.literal', '$(touch should-not-exist); "quoted"'],
    cwd
  );
  assert.equal(
    await git(['config', '--get', 'test.literal'], cwd),
    '$(touch should-not-exist); "quoted"\n'
  );
  await assert.rejects(access(join(cwd, 'should-not-exist')), {
    code: 'ENOENT',
  });
});

test('git reports command failures with exit codes and context', async () => {
  const cwd = await repository();
  await assert.rejects(git(['not-a-git-command'], cwd), (error) => {
    assert.ok(error instanceof GitError);
    assert.equal(error.name, 'GitError');
    assert.equal(error.exitCode, 1);
    assert.match(error.message, /failed.*exit 1.*not-a-git-command/s);
    assert.ok(error.message.includes(cwd));
    return true;
  });
});

test('git reports spawn failures with actionable instructions', async () => {
  const cwd = await repository();
  const missing = join(cwd, 'missing');
  await assert.rejects(git(['status'], missing), (error) => {
    assert.ok(error instanceof GitError);
    assert.equal(error.exitCode, null);
    assert.match(
      error.message,
      /Check that Git is installed and the working directory exists/
    );
    assert.ok(error.message.includes(missing));
    return true;
  });
});
