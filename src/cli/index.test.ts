import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const cliUrl = new URL('./index.js', import.meta.url).href;

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execute('git', args, {
    cwd,
    env: { ...process.env, ['GIT_TERMINAL_PROMPT']: '0' },
  });
  return stdout;
}

async function cli(cwd: string, ...args: string[]) {
  const script = `import { run } from ${JSON.stringify(cliUrl)};
    run(${JSON.stringify(args)}).catch(error => {
      console.error(\`Error: \${error.message}\`);
      process.exitCode = 1;
    });`;
  try {
    const result = await execute(
      process.execPath,
      ['--input-type=module', '-e', script],
      { cwd }
    );
    return { ...result, code: 0 };
  } catch (error) {
    const result = error as Error & {
      stdout: string;
      stderr: string;
      code: number;
    };
    return { stdout: result.stdout, stderr: result.stderr, code: result.code };
  }
}

async function fixture(run: (cwd: string) => Promise<void>): Promise<void> {
  const cwd = await mkdtemp(join(tmpdir(), 'changelog-cli-'));
  try {
    await git(['init', '--initial-branch=main'], cwd);
    await git(['config', 'user.name', 'CLI Tester'], cwd);
    await git(['config', 'user.email', 'cli@example.test'], cwd);
    await git(['config', 'commit.gpgsign', 'false'], cwd);
    await git(['config', 'tag.gpgsign', 'false'], cwd);
    await run(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

async function commit(cwd: string, subject: string): Promise<void> {
  await git(['add', '.'], cwd);
  await git(['commit', '--allow-empty', '-m', subject], cwd);
}

async function history(cwd: string): Promise<void> {
  await commit(cwd, 'feat: first release');
  await git(['tag', 'v1.0.0'], cwd);
  await commit(cwd, 'fix: second release');
  await git(['tag', 'v1.0.1'], cwd);
  await commit(cwd, 'feat: upcoming feature');
}

async function snapshot(cwd: string) {
  return {
    head: await git(['rev-parse', 'HEAD'], cwd),
    tags: await git(['tag', '--list'], cwd),
    status: await git(['status', '--porcelain'], cwd),
  };
}

test('help and version work outside a repository', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'changelog-help-'));
  try {
    const help = await cli(cwd, '--help');
    assert.equal(help.code, 0);
    assert.match(help.stdout, /Usage: changelog-machine/);
    const result = await cli(cwd, '--version');
    assert.equal(result.code, 0);
    const pkg = JSON.parse(
      await readFile(new URL('../../package.json', import.meta.url), 'utf8')
    );
    assert.equal(result.stdout, `${pkg.version}\n`);
    assert.equal(result.stderr, '');
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('dry-run and full history need no package manifest', async () => {
  await fixture(async (cwd) => {
    await history(cwd);
    const preview = await cli(cwd, '--dry-run');
    assert.equal(preview.code, 0);
    assert.match(preview.stdout, /## Unreleased/);
    assert.match(preview.stdout, /upcoming feature/);
    assert.match(preview.stdout, /## v1\.0\.0/);
    assert.deepEqual(await readdir(cwd), ['.git']);
    const before = await snapshot(cwd);
    const full = await cli(
      cwd,
      '--full',
      '--output',
      'docs/history.md',
      '--repo-url',
      'https://github.com/example/project'
    );
    assert.equal(full.code, 0);
    assert.equal(full.stdout, '');
    const markdown = await readFile(join(cwd, 'docs/history.md'), 'utf8');
    assert.match(markdown, /## Unreleased/);
    assert.match(markdown, /## v1\.0\.1/);
    assert.match(markdown, /## v1\.0\.0/);
    assert.match(markdown, /github\.com\/example\/project/);
    assert.equal((await snapshot(cwd)).head, before.head);
    assert.equal((await snapshot(cwd)).tags, before.tags);
  });
});

test('full dry-run and bump leave all files and Git state unchanged', async () => {
  await fixture(async (cwd) => {
    const manifest = '{"name":"fixture","version":"1.0.1"}\n';
    const lock =
      '{"lockfileVersion":3,"version":"1.0.1","packages":{"":{"version":"1.0.1"}}}\n';
    await writeFile(join(cwd, 'package.json'), manifest);
    await writeFile(join(cwd, 'package-lock.json'), lock);
    await writeFile(join(cwd, 'CHANGELOG.md'), 'original\n');
    await history(cwd);
    const before = await snapshot(cwd);
    const result = await cli(cwd, '--full', '--bump', '--dry-run');
    assert.equal(result.code, 0);
    assert.match(result.stderr, /1\.0\.1 → 1\.1\.0 \(minor\)/);
    assert.doesNotMatch(result.stderr, /Updated/);
    assert.match(result.stdout, /## Unreleased/);
    assert.match(result.stdout, /## v1\.0\.0/);
    assert.equal(await readFile(join(cwd, 'package.json'), 'utf8'), manifest);
    assert.equal(await readFile(join(cwd, 'package-lock.json'), 'utf8'), lock);
    assert.equal(
      await readFile(join(cwd, 'CHANGELOG.md'), 'utf8'),
      'original\n'
    );
    assert.deepEqual(await snapshot(cwd), before);
    assert.deepEqual((await readdir(cwd)).sort(), [
      '.git',
      'CHANGELOG.md',
      'package-lock.json',
      'package.json',
    ]);
  });
});

test('full preview omits Unreleased without parsed qualifying commits', async () => {
  await fixture(async (cwd) => {
    await commit(cwd, 'feat: released');
    await git(['tag', 'v1.0.0'], cwd);
    for (const subject of [
      undefined,
      'maintenance without a conventional header',
    ]) {
      if (subject) await commit(cwd, subject);
      const result = await cli(cwd, '--full', '--dry-run');
      assert.equal(result.code, 0);
      assert.match(result.stdout, /## v1\.0\.0/);
      assert.doesNotMatch(result.stdout, /Unreleased/);
    }
    const included = await cli(
      cwd,
      '--full',
      '--dry-run',
      '--include-non-conventional'
    );
    assert.equal(included.code, 0);
    assert.match(included.stdout, /## Unreleased/);
    assert.match(included.stdout, /maintenance without a conventional header/);
    assert.deepEqual(await readdir(cwd), ['.git']);
  });
});

test('bump updates files only and refuses a repeated inferred bump', async () => {
  await fixture(async (cwd) => {
    await writeFile(join(cwd, 'package.json'), '{"version":"1.0.0"}\n');
    await writeFile(
      join(cwd, 'package-lock.json'),
      '{"lockfileVersion":3,"version":"1.0.0","packages":{"":{"version":"1.0.0"}}}\n'
    );
    await commit(cwd, 'feat: initial');
    await git(['tag', 'v1.0.0'], cwd);
    await commit(cwd, 'fix: bug');
    const before = await snapshot(cwd);
    const result = await cli(cwd, '--bump');
    assert.equal(result.code, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /1\.0\.0 → 1\.0\.1 \(patch\)/);
    assert.equal(
      JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8')).version,
      '1.0.1'
    );
    const lock = JSON.parse(
      await readFile(join(cwd, 'package-lock.json'), 'utf8')
    );
    assert.equal(lock.version, '1.0.1');
    assert.equal(lock.packages[''].version, '1.0.1');
    const after = await snapshot(cwd);
    assert.equal(after.head, before.head);
    assert.equal(after.tags, before.tags);
    const repeated = await cli(cwd, '--bump');
    assert.equal(repeated.code, 1);
    assert.match(repeated.stderr, /refusing a repeated inferred bump/);
    assert.deepEqual(await snapshot(cwd), after);
    assert.deepEqual((await readdir(cwd)).sort(), [
      '.git',
      'package-lock.json',
      'package.json',
    ]);
  });
});

test('default generation creates the full history including the earliest release', async () => {
  await fixture(async (cwd) => {
    await history(cwd);
    const result = await cli(cwd);
    assert.equal(result.code, 0);
    const markdown = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8');
    assert.match(markdown, /## Unreleased/);
    assert.match(markdown, /## v1\.0\.1/);
    assert.match(markdown, /## v1\.0\.0/);
    assert.match(markdown, /first release/);
  });
});

test('incremental generation preserves older bytes and updates Unreleased', async () => {
  await fixture(async (cwd) => {
    await history(cwd);
    const oldBytes = '## v1.0.0\n\nHand-maintained old release.\n';
    const existing = `# Changelog\n\n## Unreleased\n\nStale draft.\n\n${oldBytes}`;
    await writeFile(join(cwd, 'CHANGELOG.md'), existing);
    const result = await cli(cwd);
    assert.equal(result.code, 0);
    const updated = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8');
    assert.match(updated, /upcoming feature/);
    assert.match(updated, /second release/);
    assert.doesNotMatch(updated, /Stale draft/);
    assert.ok(updated.endsWith(oldBytes));
    assert.equal((updated.match(/## v1\.0\.0/g) ?? []).length, 1);
  });
});

test('incremental generation is idempotent and honors a custom default output', async () => {
  await fixture(async (cwd) => {
    await history(cwd);
    const first = await cli(cwd, '--output', 'docs/history.md');
    assert.equal(first.code, 0);
    const path = join(cwd, 'docs/history.md');
    const content = await readFile(path, 'utf8');
    await writeFile(path, content);
    const fixedTime = new Date('2000-01-01T00:00:00Z');
    await utimes(path, fixedTime, fixedTime);
    const before = await stat(path);
    const second = await cli(cwd, '--output', 'docs/history.md');
    assert.equal(second.code, 0);
    assert.equal(await readFile(path, 'utf8'), content);
    assert.equal((await stat(path)).mtimeMs, before.mtimeMs);
  });
});

test('malformed incremental changelogs fail unless full regeneration is requested', async () => {
  await fixture(async (cwd) => {
    await history(cwd);
    await writeFile(join(cwd, 'CHANGELOG.md'), 'not a changelog\n');
    const incremental = await cli(cwd);
    assert.equal(incremental.code, 1);
    assert.match(incremental.stderr, /Use --full to regenerate/);
    const full = await cli(cwd, '--full');
    assert.equal(full.code, 0);
    assert.match(
      await readFile(join(cwd, 'CHANGELOG.md'), 'utf8'),
      /## v1\.0\.0/
    );
  });
});

test('missing incremental release boundary fails unless full regeneration is requested', async () => {
  await fixture(async (cwd) => {
    await history(cwd);
    await writeFile(
      join(cwd, 'CHANGELOG.md'),
      '# Changelog\n\n## v9.9.9\n\nOld entry.\n'
    );
    const incremental = await cli(cwd);
    assert.equal(incremental.code, 1);
    assert.match(incremental.stderr, /v9\.9\.9/);
    const full = await cli(cwd, '--full');
    assert.equal(full.code, 0);
    assert.match(
      await readFile(join(cwd, 'CHANGELOG.md'), 'utf8'),
      /## v1\.0\.0/
    );
    assert.doesNotMatch(
      await readFile(join(cwd, 'CHANGELOG.md'), 'utf8'),
      /v9\.9\.9/
    );
  });
});

test('bump without qualifying commits is a no-op', async () => {
  await fixture(async (cwd) => {
    const manifest = '{"version":"1.0.0"}\n';
    await writeFile(join(cwd, 'package.json'), manifest);
    await commit(cwd, 'initial maintenance');
    await git(['tag', 'v1.0.0'], cwd);
    const before = await snapshot(cwd);
    const result = await cli(cwd, '--bump');
    assert.equal(result.code, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /No version bump \(1\.0\.0\)/);
    assert.equal(await readFile(join(cwd, 'package.json'), 'utf8'), manifest);
    assert.deepEqual(await snapshot(cwd), before);
  });
});

test('invalid arguments and protected metadata outputs fail without writes', async () => {
  await fixture(async (cwd) => {
    await writeFile(join(cwd, 'package.json'), '{"version":"1.0.0"}\n');
    await commit(cwd, 'feat: initial');
    await git(['tag', 'v1.0.0'], cwd);
    await commit(cwd, 'fix: bug');
    const before = await snapshot(cwd);
    for (const [args, message] of [
      [['--unknown'], /Unknown option/],
      [['unexpected'], /Unexpected argument/],
      [
        ['--bump', '--output', 'other.md'],
        /--output requires changelog generation/,
      ],
      [
        ['--full', '--repo-url', 'http://example.com/repo'],
        /--repo-url must be an HTTPS/,
      ],
      ...['package.json', 'package-lock.json', 'npm-shrinkwrap.json'].map(
        (name) => [
          ['--full', '--bump', '--output', `./${name}`],
          /must not overwrite package metadata/,
        ]
      ),
    ] as [string[], RegExp][]) {
      const result = await cli(cwd, ...args);
      assert.equal(result.code, 1);
      assert.match(result.stderr, message);
      assert.equal(
        await readFile(join(cwd, 'package.json'), 'utf8'),
        '{"version":"1.0.0"}\n'
      );
      assert.deepEqual(await snapshot(cwd), before);
      assert.deepEqual((await readdir(cwd)).sort(), ['.git', 'package.json']);
    }
  });
});

test('failed staging leaves earlier destinations untouched and removes temporary files', async () => {
  await fixture(async (cwd) => {
    const manifest = '{"version":"1.0.0"}\n';
    await writeFile(join(cwd, 'package.json'), manifest);
    await commit(cwd, 'feat: initial');
    await git(['tag', 'v1.0.0'], cwd);
    await commit(cwd, 'fix: bug');
    const before = await snapshot(cwd);
    const result = await cli(cwd, '--bump', '--full', '--output', '.');
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Not a regular file/);
    assert.equal(await readFile(join(cwd, 'package.json'), 'utf8'), manifest);
    assert.deepEqual(await snapshot(cwd), before);
    assert.deepEqual((await readdir(cwd)).sort(), ['.git', 'package.json']);
  });
});
