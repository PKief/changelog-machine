import assert from 'node:assert/strict';
import test from 'node:test';
import {
  commitReference,
  compareUrl,
  linkIssueReferences,
  repositoryBase,
} from './links.js';

test('inline issue numbers link to their repository without changing existing links or code', () => {
  const repository = repositoryBase('https://github.com/example/repo');
  assert.equal(
    linkIssueReferences('Remove brs (Closes #3554), fixes #42', repository),
    'Remove brs (Closes [#3554](https://github.com/example/repo/issues/3554)), fixes [#42](https://github.com/example/repo/issues/42)'
  );
  const protectedText =
    '`#42` [#42](https://example.com/issues/42) https://example.com/#42 owner/repo#42 \\#42';
  assert.equal(linkIssueReferences(protectedText, repository), protectedText);
  assert.equal(linkIssueReferences('Closes #42'), 'Closes #42');
  assert.equal(
    linkIssueReferences(
      'Fixes #42',
      repositoryBase('https://gitlab.com/group/repo')
    ),
    'Fixes [#42](https://gitlab.com/group/repo/-/issues/42)'
  );
});

const commit = (pr?: string) => ({
  hash: '123456789abc',
  name: 'Alice',
  email: '',
  subject: 'fix: bug',
  body: '',
  type: 'fix',
  description: 'bug',
  breaking: false,
  breakingNotes: [],
  pr,
});

test('uses provider-specific repository routes', () => {
  for (const [host, comparison, pullRequest, hash] of [
    [
      'github.com',
      '/compare/v1.0.0...v2.0.0',
      '/pull/42',
      '/commit/123456789abc',
    ],
    [
      'gitlab.com',
      '/-/compare/v1.0.0...v2.0.0',
      '/-/merge_requests/42',
      '/-/commit/123456789abc',
    ],
    [
      'bitbucket.org',
      '/branches/compare/v2.0.0..v1.0.0',
      '/pull-requests/42',
      '/commits/123456789abc',
    ],
  ]) {
    const base = `https://${host}/group/repo`;
    const repository = repositoryBase(base);
    assert.ok(repository);
    assert.deepEqual(repository, { base, host });
    assert.equal(
      compareUrl(repository, 'v1.0.0', 'v2.0.0'),
      `${base}${comparison}`
    );
    assert.equal(
      commitReference(commit('42'), repository),
      `([#42](${base}${pullRequest}))`
    );
    assert.equal(
      commitReference(commit(), repository),
      `([12345678](${base}${hash}))`
    );
  }
});

test('normalizes repository URLs and removes query strings and fragments', () => {
  assert.deepEqual(
    repositoryBase('https://github.com/group/repo.git///?query=value#fragment'),
    { base: 'https://github.com/group/repo', host: 'github.com' }
  );
  assert.deepEqual(repositoryBase('http://gitlab.com/group/repo/'), {
    base: 'http://gitlab.com/group/repo',
    host: 'gitlab.com',
  });
});

test('unsupported or unsafe URLs use plain references', () => {
  for (const url of [
    undefined,
    '',
    'not a URL',
    'https://example.com/group/repo',
    'https://github.com.example.com/group/repo',
    'javascript:alert(1)',
    'ftp://github.com/group/repo',
    'https://user:password@github.com/group/repo',
    'https://user@github.com/group/repo',
  ]) {
    const repository = repositoryBase(url);
    assert.equal(repository, undefined);
    assert.equal(commitReference(commit('42'), repository), '(#42)');
    assert.equal(commitReference(commit(), repository), '(12345678)');
  }
});

test('escapes parentheses in repository URLs and encodes reference paths', () => {
  const repository = repositoryBase('https://github.com/group/repo(test)');
  assert.ok(repository);
  assert.equal(repository.base, 'https://github.com/group/repo%28test%29');
  assert.equal(
    commitReference(commit('42'), repository),
    '([#42](https://github.com/group/repo%28test%29/pull/42))'
  );
  assert.equal(
    compareUrl(repository, 'release/1', 'release/2'),
    'https://github.com/group/repo%28test%29/compare/release%2F1...release%2F2'
  );
  assert.equal(
    commitReference({ ...commit(), hash: 'abc/def(value)' }, repository),
    '([abc/def\\(](https://github.com/group/repo%28test%29/commit/abc%2Fdef%28value%29))'
  );
});

test('escapes plain hash labels', () => {
  assert.equal(
    commitReference({ ...commit(), hash: '<a>&*[]!' }),
    '(&lt;a&gt;&amp;\\*\\[\\]\\!)'
  );
});
