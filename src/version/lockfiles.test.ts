import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readLockfiles, updateLockfile } from './lockfiles.js';

async function fixture(run: (cwd: string) => Promise<void>): Promise<void> {
  const cwd = await mkdtemp(join(tmpdir(), 'version-lockfiles-'));
  try {
    await run(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

test('readLockfiles returns an empty list when no lockfile exists', async () => {
  await fixture(async (cwd) => {
    assert.deepEqual(await readLockfiles(cwd), []);
  });
});

for (const name of ['package-lock.json', 'npm-shrinkwrap.json']) {
  test(`readLockfiles reads ${name} without parsing or modifying it`, async () => {
    await fixture(async (cwd) => {
      const path = join(cwd, name);
      const content = 'raw lockfile text\r\n';
      await writeFile(path, content);
      assert.deepEqual(await readLockfiles(cwd), [{ path, content }]);
      assert.equal(await readFile(path, 'utf8'), content);
    });
  });
}

test('readLockfiles rejects ambiguous npm lockfiles', async () => {
  await fixture(async (cwd) => {
    for (const name of ['package-lock.json', 'npm-shrinkwrap.json']) {
      await writeFile(join(cwd, name), '{}');
    }
    await assert.rejects(
      readLockfiles(cwd),
      /Both package-lock\.json and npm-shrinkwrap\.json exist/
    );
  });
});

for (const names of [
  ['pnpm-lock.yaml'],
  ['yarn.lock'],
  ['pnpm-lock.yaml', 'yarn.lock'],
]) {
  test(`readLockfiles rejects unsupported lockfiles: ${names.join(', ')}`, async () => {
    await fixture(async (cwd) => {
      await writeFile(join(cwd, 'package-lock.json'), '{}');
      for (const name of names) await writeFile(join(cwd, name), '');
      await assert.rejects(readLockfiles(cwd), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(
          error.message.includes(`Unsupported lockfile: ${names.join(', ')}`)
        );
        return true;
      });
    });
  });
}

for (const lockfileVersion of [1, 2, 3]) {
  test(`updateLockfile updates npm v${lockfileVersion} root versions, preserving dependencies and formatting`, () => {
    const source = {
      name: 'fixture',
      version: '1.2.3',
      lockfileVersion,
      ...(lockfileVersion === 1
        ? {}
        : {
            packages: {
              '': { name: 'fixture', version: '1.2.3' },
              'node_modules/dependency': { version: '4.5.6' },
            },
          }),
      dependencies: { dependency: { version: '4.5.6' } },
    };
    const original =
      JSON.stringify(source, null, '\t').replace(/\n/g, '\r\n') + '\r\n';
    const updated = updateLockfile('package-lock.json', original, '2.0.0');
    const expected = JSON.parse(original);
    expected.version = '2.0.0';
    if (lockfileVersion !== 1) expected.packages[''].version = '2.0.0';
    assert.equal(
      updated,
      JSON.stringify(expected, null, '\t').replace(/\n/g, '\r\n') + '\r\n'
    );
    assert.equal(source.version, '1.2.3');
  });
}

test('updateLockfile updates optional packages in npm v1 and preserves compact formatting', () => {
  const original =
    '{"lockfileVersion":1,"version":"1.2.3","packages":{"":{"version":"1.2.3"}}}';
  assert.equal(
    updateLockfile('npm-shrinkwrap.json', original, '1.2.4'),
    '{"lockfileVersion":1,"version":"1.2.4","packages":{"":{"version":"1.2.4"}}}'
  );
});

test('updateLockfile rejects invalid JSON, non-objects and unsupported versions', () => {
  assert.throws(
    () => updateLockfile('lock.json', '{', '2.0.0'),
    /Invalid JSON in lock\.json/
  );
  for (const content of ['null', '[]', '42']) {
    assert.throws(
      () => updateLockfile('lock.json', content, '2.0.0'),
      /Expected a JSON object in lock\.json/
    );
  }
  for (const lockfileVersion of [undefined, 0, 4, '2', null]) {
    assert.throws(
      () =>
        updateLockfile(
          'lock.json',
          JSON.stringify({ lockfileVersion, version: '1.2.3' }),
          '2.0.0'
        ),
      /Unsupported lockfileVersion in lock\.json/
    );
  }
});

test('updateLockfile validates root and packages versions', () => {
  for (const version of [undefined, null, 123]) {
    assert.throws(
      () =>
        updateLockfile(
          'lock.json',
          JSON.stringify({ lockfileVersion: 1, version }),
          '2.0.0'
        ),
      /Malformed lock\.json: missing root version/
    );
  }
  for (const lockfileVersion of [1, 2, 3]) {
    for (const packages of [
      undefined,
      null,
      [],
      {},
      { '': null },
      { '': [] },
      { '': {} },
      { '': { version: 123 } },
    ]) {
      if (lockfileVersion === 1 && packages === undefined) continue;
      assert.throws(
        () =>
          updateLockfile(
            'lock.json',
            JSON.stringify({ lockfileVersion, version: '1.2.3', packages }),
            '2.0.0'
          ),
        /Malformed lock\.json: missing packages\[''\]\.version/
      );
    }
  }
});
