import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { promisify } from 'node:util';
import { getLatestReleaseTag, getReleases } from './history.js';

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

async function commit(
  cwd: string,
  subject: string,
  body?: string
): Promise<string> {
  await runGit(
    ['commit', '--allow-empty', '-m', subject, ...(body ? ['-m', body] : [])],
    cwd
  );
  return (await runGit(['rev-parse', 'HEAD'], cwd)).trim();
}

test('earliest history, annotated tags, full bodies, mailmap and newest-first ranges', async () => {
  const cwd = await repository();
  const first = await commit(cwd, 'initial');
  const body =
    'First paragraph.\n\nSecond paragraph with _||_ and Unicode: café.';
  const second = await commit(cwd, 'first release', body);
  await runGit(['tag', '-a', 'v2.0.0', '-m', 'annotated release'], cwd);
  const third = await commit(cwd, 'second release');
  // Intentionally decreasing versions: ancestry, not SemVer, determines order.
  await runGit(['tag', '1.0.0-rc.1+build.7'], cwd);
  const fourth = await commit(cwd, 'pending');
  await writeFile(
    join(cwd, '.mailmap'),
    'Mapped Author <mapped@example.com> Original Author <original@example.com>\n'
  );
  const releases = await getReleases(cwd);
  assert.deepEqual(
    releases.map((r) => r.tag),
    ['Unreleased', '1.0.0-rc.1+build.7', 'v2.0.0']
  );
  assert.deepEqual(
    releases.map((r) => r.previousTag),
    ['1.0.0-rc.1+build.7', 'v2.0.0', undefined]
  );
  assert.deepEqual(
    releases.map((r) => r.commits.map((c) => c.hash)),
    [[fourth], [third], [second, first]]
  );
  assert.equal(releases[2].commits[0].body, `${body}\n`);
  for (const release of releases) {
    for (const c of release.commits) {
      assert.equal(c.name, 'Mapped Author');
      assert.equal(c.email, 'mapped@example.com');
    }
  }
});

test('incremental releases return only history after the boundary and include Unreleased', async () => {
  const cwd = await repository();
  await commit(cwd, 'old root');
  await runGit(['tag', '1.0.0'], cwd);
  await commit(cwd, 'old release change');
  await runGit(['tag', '2.0.0'], cwd);
  await commit(cwd, 'new release change');
  await runGit(['tag', '3.0.0'], cwd);
  await commit(cwd, 'pending change');

  const releases = await getReleases(cwd, '2.0.0');
  assert.deepEqual(
    releases.map((release) => release.tag),
    ['Unreleased', '3.0.0']
  );
  assert.deepEqual(
    releases[0].commits.map((item) => item.subject),
    ['pending change']
  );
  assert.deepEqual(
    releases[1].commits.map((item) => item.subject),
    ['new release change']
  );
  assert.equal(await getLatestReleaseTag(cwd), '3.0.0');
});

test('incremental releases validate boundary existence and reachability', async () => {
  const cwd = await repository();
  await commit(cwd, 'main root');
  await runGit(['tag', '1.0.0'], cwd);
  await assert.rejects(getReleases(cwd, '2.0.0'), /boundary tag not found/);
  await runGit(['checkout', '--orphan', 'unrelated'], cwd);
  await commit(cwd, 'unrelated root');
  await runGit(['tag', '2.0.0'], cwd);
  await runGit(['checkout', 'main'], cwd);
  await assert.rejects(getReleases(cwd, '2.0.0'), /not reachable from HEAD/);
});

test('no version tags returns all history as Unreleased', async () => {
  const cwd = await repository();
  await commit(cwd, 'initial');
  await runGit(['tag', 'not-a-version'], cwd);
  await runGit(['tag', 'v01.0.0'], cwd);
  await runGit(['tag', '1.0.0-01'], cwd);
  await commit(cwd, 'next');
  const releases = await getReleases(cwd);
  assert.equal(releases.length, 1);
  assert.equal(releases[0].tag, 'Unreleased');
  assert.equal(releases[0].previousTag, undefined);
  assert.deepEqual(
    releases[0].commits.map((c) => c.subject),
    ['next', 'initial']
  );
});

test('omits empty Unreleased and ignores version tags unreachable from HEAD', async () => {
  const cwd = await repository();
  await commit(cwd, 'root');
  await runGit(['tag', '1.0.0'], cwd);
  await runGit(['checkout', '--orphan', 'unrelated'], cwd);
  await commit(cwd, 'unrelated root');
  await runGit(['tag', '9.0.0'], cwd);
  await runGit(['checkout', 'main'], cwd);
  const releases = await getReleases(cwd);
  assert.deepEqual(
    releases.map((r) => r.tag),
    ['1.0.0']
  );
  assert.equal(releases[0].commits[0].subject, 'root');
});

test('rejects multiple version tags at one commit, including annotated aliases', async () => {
  const cwd = await repository();
  await commit(cwd, 'root');
  await runGit(['tag', '1.0.0'], cwd);
  await runGit(['tag', '-a', 'v1.0.0', '-m', 'alias'], cwd);
  await assert.rejects(getReleases(cwd), /Ambiguous.*same commit/);
});

test('rejects reachable version tags on non-ancestor branches', async () => {
  const cwd = await repository();
  await commit(cwd, 'root');
  await runGit(['checkout', '-b', 'side'], cwd);
  await commit(cwd, 'side');
  await runGit(['tag', '1.0.0'], cwd);
  await runGit(['checkout', 'main'], cwd);
  await commit(cwd, 'main');
  await runGit(['tag', '2.0.0'], cwd);
  await runGit(['merge', '--no-ff', 'side', '-m', 'merge'], cwd);
  await assert.rejects(getReleases(cwd), /Ambiguous.*not ancestors/);
});

test('merge-only Unreleased ranges remain present but exclude merge commits', async () => {
  const cwd = await repository();
  await commit(cwd, 'root');
  await runGit(['checkout', '-b', 'side'], cwd);
  await commit(cwd, 'side');
  await runGit(['tag', '1.0.0'], cwd);
  await runGit(['checkout', 'main'], cwd);
  await runGit(['merge', '--no-ff', 'side', '-m', 'merge'], cwd);
  const releases = await getReleases(cwd);
  assert.equal(releases[0].tag, 'Unreleased');
  assert.deepEqual(releases[0].commits, []);
  assert.deepEqual(
    releases[1].commits.map((c) => c.subject),
    ['side', 'root']
  );
});

test('rejects shallow clones with actionable instructions', async () => {
  const source = await repository();
  await commit(source, 'root');
  await commit(source, 'next');
  const parent = await mkdtemp(join(tmpdir(), 'changelog-shallow-'));
  directories.push(parent);
  const clone = join(parent, 'clone');
  await runGit(['clone', '--depth=1', `file://${source}`, clone]);
  await assert.rejects(getReleases(clone), /shallow.*git fetch --unshallow/);
});
