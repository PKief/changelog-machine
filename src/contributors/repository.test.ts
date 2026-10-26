import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRepository } from './repository.js';

test('parses supported HTTPS repository URLs', () => {
  assert.deepEqual(parseRepository('https://github.com/Owner/Repo.git'), {
    host: 'github.com',
    path: 'Owner/Repo',
  });
  assert.deepEqual(parseRepository('https://bitbucket.org/Owner/Repo/'), {
    host: 'bitbucket.org',
    path: 'Owner/Repo',
  });
});

test('rejects unsupported or unsafe repository URLs', () => {
  for (const url of [
    undefined,
    'http://github.com/owner/repo',
    'https://user@github.com/owner/repo',
    'https://github.com/owner/repo?query=1',
    'https://github.com/owner/repo/extra',
    'https://github.com/owner/../repo',
    'https://example.com/owner/repo',
  ]) {
    assert.equal(parseRepository(url), undefined, String(url));
  }
});
