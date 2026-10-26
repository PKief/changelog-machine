import assert from 'node:assert/strict';
import test from 'node:test';
import { contributorLines } from './contributors.js';

const commit = (hash: string, name: string) => ({
  hash,
  name,
  email: 'author@example.com',
  subject: 'feat: change',
  body: '',
  type: 'feat',
  description: 'change',
  breaking: false,
  breakingNotes: [],
});

const repositoryUrl = 'https://github.com/example/project';

test('links usernames and falls back to a redacted git author name', () => {
  assert.deepEqual(
    contributorLines(
      [commit('linked', 'Alice'), commit('plain', 'Bob <bob@example.com>')],
      {
        repositoryUrl,
        contributors: {
          linked: { username: 'alice', url: 'https://github.com/alice' },
        },
      }
    ),
    ['- Alice ([@alice](https://github.com/alice))', '- Unknown contributor']
  );
});

test('does not expose an email-only author name', () => {
  const lines = contributorLines([commit('email', 'author@example.com')], {});
  assert.deepEqual(lines, ['- Unknown contributor']);
  assert.doesNotMatch(lines.join('\n'), /author@example\.com/);
});

test('rejects malicious profiles, deduplicates verified profiles, and encodes parentheses', () => {
  const lines = contributorLines(
    [
      commit('same-one', 'First'),
      commit('same-two', 'Second'),
      commit('email-user', 'Email user'),
      commit('credential-user', 'Credential user'),
      commit('javascript-user', 'JavaScript user'),
      commit('parenthesis-user', 'Parenthesis user'),
    ],
    {
      repositoryUrl: 'https://gitlab.com/example/project',
      contributors: {
        'same-one': {
          username: 'group/user',
          url: 'https://gitlab.com/group/user',
        },
        'same-two': {
          username: 'group/user',
          url: 'https://gitlab.com/group/user',
        },
        'email-user': {
          username: 'email@example.com',
          url: 'https://gitlab.com/email',
        },
        'credential-user': {
          username: 'credential',
          url: 'https://user:secret@gitlab.com/credential',
        },
        'javascript-user': { username: 'script', url: 'javascript:alert(1)' },
        'parenthesis-user': {
          username: 'group/name',
          url: 'https://gitlab.com/group/name%28unsafe%29',
        },
      },
    }
  );

  assert.deepEqual(lines, [
    '- Credential user',
    '- Email user',
    '- First ([@group/user](https://gitlab.com/group/user))',
    '- JavaScript user',
    '- Parenthesis user ([@group/name](https://gitlab.com/group/name%28unsafe%29))',
  ]);
  assert.equal(lines.filter((line) => line.includes('@group/user')).length, 1);
  assert.doesNotMatch(
    lines.join('\n'),
    /secret|javascript:|email@example\.com/
  );
});
