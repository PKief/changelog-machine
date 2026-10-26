import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCommit, recommendedBump } from './parse.js';

const commit = (subject: string, body = '') => ({
  hash: '123456789abcdef',
  name: 'Alice',
  email: 'alice@example.com',
  subject,
  body,
});

test('parses scope, bang and trailing pull request without changing metadata', () => {
  const source = commit('feat(api)!: support **tokens** (#123)');
  assert.deepEqual(parseCommit(source), {
    ...source,
    type: 'feat',
    scope: 'api',
    description: 'support **tokens**',
    breaking: true,
    breakingNotes: [],
    pr: '123',
  });
  assert.equal(source.subject, 'feat(api)!: support **tokens** (#123)');
});

test('parses both multiline breaking footer spellings and stops at another footer', () => {
  const parsed = parseCommit(
    commit(
      'fix: update API',
      'Details\r\n\r\nBREAKING CHANGE: old API removed\r\nUse the new API.\r\n\r\nRefs: #12\r\nBREAKING-CHANGE: config changed\r\n  Rename the key.'
    )
  );
  assert.equal(parsed?.breaking, true);
  assert.deepEqual(parsed?.breakingNotes, [
    'old API removed\nUse the new API.',
    'config changed\n  Rename the key.',
  ]);
});

test('excludes ordinary subjects unless opted in and accepts unknown types', () => {
  assert.equal(parseCommit(commit('Merge a branch')), undefined);
  assert.equal(parseCommit(commit('Merge a branch'), true)?.type, 'other');
  assert.equal(parseCommit(commit('custom: do something'))?.type, 'custom');
  assert.equal(
    parseCommit(commit('fix: retain (#12) in the middle'))?.pr,
    undefined
  );
  assert.equal(parseCommit(commit('fix!: change'))?.breaking, true);
});

test('recommended bumps use precedence, including performance patches', () => {
  assert.equal(recommendedBump([]), undefined);
  assert.equal(
    recommendedBump([commit('docs: document'), commit('ordinary')]),
    undefined
  );
  assert.equal(recommendedBump([commit('fix: repair')]), 'patch');
  assert.equal(recommendedBump([commit('perf: faster')]), 'patch');
  assert.equal(
    recommendedBump([commit('feat: add'), commit('fix: repair')]),
    'minor'
  );
  assert.equal(
    recommendedBump([commit('fix: repair'), commit('feat: add')]),
    'minor'
  );
  assert.equal(
    recommendedBump([commit('feat: add'), commit('chore!: remove')]),
    'major'
  );
  assert.equal(
    recommendedBump([commit('fix: change', 'BREAKING CHANGE: removed')]),
    'major'
  );
});
