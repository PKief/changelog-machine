import assert from 'node:assert/strict';
import test from 'node:test';
import { isVersionTag } from './tags.js';

test('recognizes stable releases, prereleases and build metadata', () => {
  for (const tag of [
    '0.0.0',
    'v1.2.3',
    '1.2.3-alpha.1',
    'v1.2.3-rc-1+build.001',
  ]) {
    assert.equal(isVersionTag(tag), true, tag);
  }
});

test('rejects malformed versions and leading zero prerelease numbers', () => {
  for (const tag of [
    '',
    'v',
    '01.2.3',
    '1.2',
    '1.2.3-',
    '1.2.3-01',
    '1.2.3+',
    '1.2.3+a+b',
    '1.2.3-a..b',
    '1.2.3+x_y',
  ]) {
    assert.equal(isVersionTag(tag), false, tag);
  }
});
