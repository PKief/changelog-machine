import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { planVersion } from './plan.js';

function commits(...subjects: string[]) {
  return subjects.map((subject, i) => ({
    hash: String(i),
    name: 'Test',
    email: 'test@example.test',
    subject,
    body: '',
  }));
}

async function fixture(
  run: (cwd: string) => Promise<void>,
  version = '1.2.3'
): Promise<void> {
  const cwd = await mkdtemp(join(tmpdir(), 'version-plan-'));
  try {
    await writeFile(
      join(cwd, 'package.json'),
      JSON.stringify({ name: 'fixture', version })
    );
    await run(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

test('commit bump precedence: breaking > feature > fix, independent of order', async () => {
  await fixture(async (cwd) => {
    for (const subjects of [
      ['fix: bug'],
      ['fix: bug', 'feat: feature'],
      ['feat: feature', 'fix: bug'],
      ['fix: bug', 'feat!: incompatible change', 'feat: feature'],
    ]) {
      const plan = await planVersion(commits(...subjects), 'v1.2.3', cwd);
      const breaking = subjects.some((subject) => subject.includes('!'));
      const feature = subjects.some((subject) => subject.startsWith('feat:'));
      assert.equal(plan.bump, breaking ? 'major' : feature ? 'minor' : 'patch');
      assert.equal(plan.next, breaking ? '2.0.0' : feature ? '1.3.0' : '1.2.4');
      assert.deepEqual(plan.files, []);
    }
  });
});

test('without a tag the package version is the baseline', async () => {
  await fixture(async (cwd) =>
    assert.equal(
      (await planVersion(commits('fix: bug'), undefined, cwd)).next,
      '1.2.4'
    )
  );
});

test('breaking changes bump major even on 0.x', async () => {
  await fixture(
    async (cwd) =>
      assert.equal(
        (await planVersion(commits('feat!: remove API'), 'v0.4.9', cwd)).next,
        '1.0.0'
      ),
    '0.4.9'
  );
});

test('planning does not read, validate or change any lockfile', async () => {
  await fixture(async (cwd) => {
    const manifest = await readFile(join(cwd, 'package.json'), 'utf8');
    for (const name of [
      'package-lock.json',
      'npm-shrinkwrap.json',
      'pnpm-lock.yaml',
      'yarn.lock',
      'bun.lock',
      'bun.lockb',
    ]) {
      await writeFile(join(cwd, name), 'opaque lockfile content');
    }
    const plan = await planVersion(commits('fix: bug'), 'v1.2.3', cwd);
    assert.equal(plan.next, '1.2.4');
    assert.deepEqual(plan.files, []);
    assert.equal(await readFile(join(cwd, 'package.json'), 'utf8'), manifest);
  });
});

for (const latestTag of ['v1.2.2', '1.2.4', 'v1.2.3-beta.1']) {
  test(`rejects tag/package mismatch ${latestTag}`, async () => {
    await fixture(async (cwd) =>
      assert.rejects(
        planVersion(commits('fix: bug'), latestTag, cwd),
        /does not match package\.json/
      )
    );
  });
}

for (const version of [
  '1.2.3-beta.1',
  '1.2.3+build',
  '01.2.3',
  '1.2',
  '',
  'v1.2.3',
  '1.2.3\n',
]) {
  test(`rejects unsupported package version ${JSON.stringify(version)}`, async () => {
    await fixture(
      async (cwd) =>
        assert.rejects(
          planVersion(commits('fix: bug'), undefined, cwd),
          /must be stable semver/
        ),
      version
    );
  });
}

test('no-op for empty commits or commits without a release bump', async () => {
  await fixture(async (cwd) => {
    for (const input of [
      [],
      commits('docs: improve readme', 'chore: housekeeping'),
    ]) {
      assert.deepEqual(await planVersion(input, 'v1.2.3', cwd), {
        current: '1.2.3',
        files: [],
      });
    }
  });
});
