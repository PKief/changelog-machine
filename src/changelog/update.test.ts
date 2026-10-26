import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeChangelog, parseChangelog } from './update.js';

test('parseChangelog separates intro and tagged history and discards Unreleased', () => {
  const source =
    '# Changelog\n\nIntro text.\n\n## Unreleased\n\nNext work.\n\n## v1.2.3\n\nOld release.\n';
  assert.deepEqual(parseChangelog(source), {
    boundaryTag: 'v1.2.3',
    prefix: '# Changelog\n\nIntro text.\n\n',
    history: '## v1.2.3\n\nOld release.\n',
  });
});

test('parseChangelog ignores fenced headings and retains the intro', () => {
  const source =
    '# Changelog\n\n```md\n## not a release\n```\n\nIntro.\n\n## v1.0.0\n\nRelease.\n';
  assert.equal(parseChangelog(source).boundaryTag, 'v1.0.0');
  assert.ok(parseChangelog(source).prefix.includes('## not a release'));
});

test('parseChangelog rejects malformed release sections with --full guidance', () => {
  for (const contents of [
    '# Changelog\n\n## notes\n',
    '# Changelog\n\n## v1.0.0\n\n## v1.0.0\n',
    '# Changelog\n\n## v1.0.0\n\n## Unreleased\n',
    'Changelog\n',
  ]) {
    assert.throws(() => parseChangelog(contents), /Use --full/);
  }
});

test('mergeChangelog keeps generated Unreleased and appends old history', () => {
  const existing = parseChangelog(
    '# Changelog\n\nIntro.\n\n## v1.0.0\n\nOld release.\n'
  );
  const generated =
    '# Changelog\n\n## Unreleased\n\nNew work.\n\n## v2.0.0\n\nNew release.\n';
  assert.equal(
    mergeChangelog(existing, generated),
    '# Changelog\n\nIntro.\n\n## Unreleased\n\nNew work.\n\n## v2.0.0\n\nNew release.\n\n## v1.0.0\n\nOld release.\n'
  );
});

test('mergeChangelog removes a duplicate boundary tag without dropping Unreleased', () => {
  const existing = parseChangelog('# Changelog\n\n## v1.0.0\n\nOld release.\n');
  const generated =
    '# Changelog\n\n## Unreleased\n\nCurrent work.\n\n## v2.0.0\n\nCurrent release.\n\n## v1.0.0\n\nDuplicate.\n';
  assert.equal(
    mergeChangelog(existing, generated),
    '# Changelog\n\n## Unreleased\n\nCurrent work.\n\n## v2.0.0\n\nCurrent release.\n\n## v1.0.0\n\nOld release.\n'
  );
});
