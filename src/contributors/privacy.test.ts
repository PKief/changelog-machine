import assert from 'node:assert/strict';
import test from 'node:test';
import { authorName, redactEmails } from './privacy.js';

test('redacts plain and percent-encoded email addresses', () => {
  assert.equal(
    redactEmails('Contact alice@example.com or bob%40example.org.'),
    'Contact [redacted email] or [redacted email].'
  );
});

test('uses Unknown contributor for empty or email-containing author names', () => {
  assert.equal(authorName('  '), 'Unknown contributor');
  assert.equal(authorName('alice@example.com'), 'Unknown contributor');
  assert.equal(authorName('Alice <alice@example.com>'), 'Unknown contributor');
  assert.equal(authorName(' Alice '), 'Alice');
});
