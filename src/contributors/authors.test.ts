import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupAuthorCommits } from './authors.js';

test('groups authors by trimmed, case-insensitive email', () => {
  assert.deepEqual(
    groupAuthorCommits([
      { hash: 'abcdef1', email: ' Alice@Example.com ' },
      { hash: 'abcdef2', email: 'alice@example.COM', name: 'Alice Smith' },
    ]),
    [['abcdef1', 'abcdef2']]
  );
});

test('uses names only when email is missing and keeps different emails separate', () => {
  assert.deepEqual(
    groupAuthorCommits([
      { hash: 'abcdef1', name: 'Alice Smith' },
      { hash: 'abcdef2', name: 'Alice Smith', email: 'alice@example.com' },
      { hash: 'abcdef3', name: 'Alice Smith', email: 'alice@other.example' },
      { hash: 'abcdef4', name: 'Alice Smith' },
    ]),
    [['abcdef1', 'abcdef4'], ['abcdef2'], ['abcdef3']]
  );
});

test('uses commit hashes for anonymous authors and deduplicates hashes', () => {
  assert.deepEqual(
    groupAuthorCommits([
      { hash: 'abcdef1' },
      { hash: 'abcdef1', name: '   ', email: '  ' },
      { hash: 'abcdef2' },
    ]),
    [['abcdef1'], ['abcdef2']]
  );
});
