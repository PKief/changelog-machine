import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { formatJson, isObject, parseObject, readOptionalFile } from './json.js';

test('isObject accepts objects but rejects arrays, null and primitives', () => {
  for (const value of [{}, { version: '1.2.3' }]) {
    assert.equal(isObject(value), true);
  }
  for (const value of [null, undefined, [], 'text', 42, true]) {
    assert.equal(isObject(value), false);
  }
});

test('parseObject parses objects and reports invalid input with its path', () => {
  assert.deepEqual(parseObject('{"version":"1.2.3"}', 'fixture.json'), {
    version: '1.2.3',
  });
  assert.throws(
    () => parseObject('{', 'fixture.json'),
    /Invalid JSON in fixture\.json/
  );
  for (const text of ['null', '[]', '"text"', '42', 'true']) {
    assert.throws(
      () => parseObject(text, 'fixture.json'),
      /Expected a JSON object in fixture\.json/
    );
  }
});

test('formatJson preserves indentation, line endings and final newline', () => {
  const value = { version: '2.0.0' };
  for (const indent of ['  ', '    ', '\t']) {
    for (const newline of ['\n', '\r\n']) {
      for (const ending of ['', newline]) {
        const original = `{${newline}${indent}"version": "1.2.3"${newline}}${ending}`;
        assert.equal(
          formatJson(value, original),
          `{${newline}${indent}"version": "2.0.0"${newline}}${ending}`
        );
      }
    }
  }
  assert.equal(formatJson(value, '{"version":"1.2.3"}'), '{"version":"2.0.0"}');
  assert.equal(formatJson(value, '{}\n'), '{"version":"2.0.0"}\n');
});

test('readOptionalFile reads UTF-8, ignores missing files and propagates other errors', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'version-json-'));
  try {
    const path = join(cwd, 'fixture.json');
    assert.equal(await readOptionalFile(path), undefined);
    const content = '{"name":"café"}\n';
    await writeFile(path, content);
    assert.equal(await readOptionalFile(path), content);
    assert.equal(await readFile(path, 'utf8'), content);
    await assert.rejects(readOptionalFile(cwd), { code: 'EISDIR' });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
