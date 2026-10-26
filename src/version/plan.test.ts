import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
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
      JSON.stringify({ name: 'fixture', version }, null, 2) + '\n'
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
      ['feat!: incompatible change', 'fix: bug'],
    ]) {
      const plan = await planVersion(commits(...subjects), 'v1.2.3', cwd);
      const breaking = subjects.some((subject) => subject.includes('!'));
      const feature = subjects.some((subject) => subject.startsWith('feat:'));
      assert.equal(plan.bump, breaking ? 'major' : feature ? 'minor' : 'patch');
      assert.equal(plan.next, breaking ? '2.0.0' : feature ? '1.3.0' : '1.2.4');
    }
  });
});

test('without a latest tag, the package version is the baseline', async () => {
  await fixture(async (cwd) => {
    const plan = await planVersion(commits('fix: bug'), undefined, cwd);
    assert.equal(plan.current, '1.2.3');
    assert.equal(plan.next, '1.2.4');
  });
});

test('breaking changes bump major even on 0.x', async () => {
  await fixture(async (cwd) => {
    const plan = await planVersion(commits('feat!: remove API'), 'v0.4.9', cwd);
    assert.equal(plan.bump, 'major');
    assert.equal(plan.next, '1.0.0');
  }, '0.4.9');
});

for (const name of ['package-lock.json', 'npm-shrinkwrap.json']) {
  for (const lockfileVersion of [1, 2, 3]) {
    test(`${name} v${lockfileVersion}: updates only root versions, without writing`, async () => {
      await fixture(async (cwd) => {
        const dependencies = {
          other: { version: '1.2.3', resolved: 'https://example.test/other' },
        };
        const packages = {
          '': {
            name: 'fixture',
            version: '1.2.3',
            dependencies: { other: '^1.2.3' },
          },
          'node_modules/other': { version: '1.2.3' },
        };
        const lock = {
          name: 'fixture',
          version: '1.2.3',
          lockfileVersion,
          dependencies,
          ...(lockfileVersion > 1 ? { packages } : {}),
        };
        const original = JSON.stringify(lock, null, '\t') + '\r\n';
        const path = join(cwd, name);
        await writeFile(path, original);
        const originalManifest = await readFile(
          join(cwd, 'package.json'),
          'utf8'
        );
        const plan = await planVersion(commits('fix: bug'), '1.2.3', cwd);
        assert.equal(plan.files.length, 2);
        const output = plan.files.find((file) => file.path === path);
        assert.ok(output);
        const updated = JSON.parse(output.content);
        assert.equal(updated.version, '1.2.4');
        assert.deepEqual(updated.dependencies, dependencies);
        if (lockfileVersion > 1) {
          assert.deepEqual(updated.packages, {
            ...packages,
            '': { ...packages[''], version: '1.2.4' },
          });
        }
        assert.ok(output.content.includes('\r\n\t"'));
        assert.ok(output.content.endsWith('\r\n'));
        const manifest = plan.files.find(
          (file) => file.path === join(cwd, 'package.json')
        );
        assert.ok(manifest);
        assert.ok(manifest.content.includes('\n  "version": "1.2.4"'));
        assert.ok(manifest.content.endsWith('\n'));
        assert.equal(await readFile(path, 'utf8'), original);
        assert.equal(
          await readFile(join(cwd, 'package.json'), 'utf8'),
          originalManifest
        );
        assert.deepEqual(
          (await readdir(cwd)).sort(),
          ['package.json', name].sort()
        );
      });
    });
  }
}

test('tag mismatch rejects a repeated inferred bump with actionable guidance', async () => {
  await fixture(async (cwd) => {
    await assert.rejects(
      planVersion(commits('fix: bug'), 'v1.2.3', cwd),
      /does not match.*Tag the current release.*repeated inferred bump/
    );
    await assert.rejects(planVersion([], '1.2.3', cwd), /does not match/);
  }, '1.2.4');
});

for (const version of [
  '1.2.3-beta.1',
  '1.2.3+build',
  'v1.2.3',
  '01.2.3',
  '1.2',
]) {
  test(`rejects unsupported version ${version}`, async () => {
    await fixture(async (cwd) => {
      await assert.rejects(
        planVersion(commits('fix: bug'), undefined, cwd),
        /stable semver/
      );
    }, version);
  });
}

for (const name of ['pnpm-lock.yaml', 'yarn.lock']) {
  test(`rejects ${name} only when a bump is needed`, async () => {
    await fixture(async (cwd) => {
      await writeFile(join(cwd, name), 'lockfile content');
      await assert.rejects(
        planVersion(commits('fix: bug'), undefined, cwd),
        /Unsupported lockfile/
      );
      assert.deepEqual(await planVersion([], undefined, cwd), {
        current: '1.2.3',
        files: [],
      });
    });
  });
}

test('rejects ambiguous npm lockfiles', async () => {
  await fixture(async (cwd) => {
    await writeFile(join(cwd, 'package-lock.json'), '{}');
    await writeFile(join(cwd, 'npm-shrinkwrap.json'), '{}');
    await assert.rejects(
      planVersion(commits('fix: bug'), undefined, cwd),
      /Both.*Remove the unused lockfile/
    );
  });
});

for (const content of [
  '{',
  '[]',
  '{"lockfileVersion":4,"version":"1.2.3"}',
  '{"lockfileVersion":2,"version":"1.2.3","packages":{}}',
]) {
  test(`malformed lockfile is rejected without changing files: ${content}`, async () => {
    await fixture(async (cwd) => {
      const packagePath = join(cwd, 'package.json');
      const original = await readFile(packagePath, 'utf8');
      const lockPath = join(cwd, 'package-lock.json');
      await writeFile(lockPath, content);
      await assert.rejects(
        planVersion(commits('fix: bug'), undefined, cwd),
        /Invalid JSON|Expected a JSON object|lockfileVersion|Malformed/
      );
      assert.equal(await readFile(packagePath, 'utf8'), original);
      assert.equal(await readFile(lockPath, 'utf8'), content);
    });
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
