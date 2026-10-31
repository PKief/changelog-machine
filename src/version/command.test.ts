import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseFlags } from '../cli/options.js';
import { formatBumpCommand, runBumpCommand } from './command.js';

async function fixture(run: (cwd: string) => Promise<void>): Promise<void> {
  const cwd = await mkdtemp(join(tmpdir(), 'bump command with spaces-'));
  try {
    await writeFile(
      join(cwd, 'package.json'),
      JSON.stringify({
        name: 'fixture',
        version: '1.0.0',
        scripts: {
          preversion: 'node -e "process.exit(99)"',
          version: 'node -e "process.exit(99)"',
          postversion: 'node -e "process.exit(99)"',
        },
      })
    );
    await run(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

const fakeCommand = 'node "custom command.cjs" {version}';
const fakeScript = `const fs = require('node:fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = process.argv[2];
fs.writeFileSync('package.json', JSON.stringify(pkg));
fs.writeFileSync('bun.lock', 'updated by package manager');`;

test('command validation requires --bump and exact version placeholder', () => {
  assert.throws(
    () => parseFlags(['--bump-command', fakeCommand]),
    /requires --bump/
  );
  for (const command of ['', 'bun pm version patch']) {
    assert.throws(
      () => parseFlags(['--bump', '--bump-command', command]),
      /placeholder/
    );
  }
  assert.equal(
    formatBumpCommand('tool {version} "{version}"', '1.2.3'),
    'tool 1.2.3 "1.2.3"'
  );
  assert.throws(
    () => formatBumpCommand('tool {version}', '1.2.3; echo unsafe'),
    /stable semver/
  );
});

test('default npm updates metadata without invoking lifecycle scripts', async () => {
  await fixture(async (cwd) => {
    await runBumpCommand('1.0.1', cwd);
    assert.equal(
      JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8')).version,
      '1.0.1'
    );
    assert.deepEqual(await readdir(cwd), ['package.json']);
  });
});

for (const lockfileVersion of [1, 2, 3, 4]) {
  test(`npm owns lockfile v${lockfileVersion} updates without changing dependency records`, async () => {
    await fixture(async (cwd) => {
      const lock = {
        name: 'fixture',
        version: '1.0.0',
        lockfileVersion,
        ...(lockfileVersion === 1
          ? { dependencies: { example: { version: '2.3.4' } } }
          : {
              packages: {
                '': { name: 'fixture', version: '1.0.0' },
                'node_modules/example': {
                  version: '2.3.4',
                  resolved: 'https://example.test/package.tgz',
                  integrity: 'sha512-example',
                  ...(lockfileVersion === 4
                    ? {
                        patch: {
                          path: 'patches/example.patch',
                          hash: 'example',
                        },
                      }
                    : {}),
                },
              },
            }),
      };
      await writeFile(join(cwd, 'package-lock.json'), JSON.stringify(lock));
      await runBumpCommand('1.0.1', cwd);
      const updated = JSON.parse(
        await readFile(join(cwd, 'package-lock.json'), 'utf8')
      );
      assert.equal(updated.version, '1.0.1');
      assert.equal(updated.lockfileVersion, lockfileVersion);
      if ('dependencies' in lock)
        assert.deepEqual(updated.dependencies, lock.dependencies);
      else {
        assert.equal(updated.packages[''].version, '1.0.1');
        assert.deepEqual(
          updated.packages['node_modules/example'],
          lock.packages?.['node_modules/example']
        );
      }
    });
  });
}

test('custom command owns opaque lockfiles and handles quoted paths', async () => {
  await fixture(async (cwd) => {
    await writeFile(join(cwd, 'custom command.cjs'), fakeScript);
    await writeFile(join(cwd, 'bun.lock'), 'opaque input');
    await runBumpCommand('2.0.0', cwd, fakeCommand);
    assert.equal(
      JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8')).version,
      '2.0.0'
    );
    assert.equal(
      await readFile(join(cwd, 'bun.lock'), 'utf8'),
      'updated by package manager'
    );
  });
});

test('reports failed commands and unexpected final versions', async () => {
  await fixture(async (cwd) => {
    await assert.rejects(
      runBumpCommand('1.0.1', cwd, 'node -e "process.exit(7)" {version}'),
      /Bump command failed \(exit 7\)/
    );
    await assert.rejects(
      runBumpCommand('1.0.1', cwd, 'node -e "" {version}'),
      /did not set package.json version/
    );
  });
});
