import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { readCommits } from './commits.js';

const execFileAsync = promisify(execFile);

test('release commits are read from oldest to newest even with identical timestamps', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'changelog-order-'));
  const env = {
    ...process.env,
    ['GIT_AUTHOR_DATE']: '2025-01-01T00:00:00Z',
    ['GIT_COMMITTER_DATE']: '2025-01-01T00:00:00Z',
  };
  const git = (args: string[]) => execFileAsync('git', args, { cwd, env });
  try {
    await git(['init', '--quiet']);
    await git(['config', 'user.name', 'Alice']);
    await git(['config', 'user.email', 'alice@example.com']);
    await git(['commit', '--allow-empty', '-m', 'chore: baseline']);
    await git(['tag', 'v1.0.0']);
    const subjects = ['fix: oldest', 'feat: middle', 'fix: newest'];
    for (const subject of subjects)
      await git(['commit', '--allow-empty', '-m', subject]);
    const commits = await readCommits('v1.0.0..HEAD', cwd);
    assert.deepEqual(
      commits.map((commit) => commit.subject),
      subjects
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
