import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeCharacter, encodeSegment, plainText, safeText } from './text.js';

test('safeText escapes HTML while preserving Markdown', () => {
  assert.equal(
    safeText('**bold** & <script>"text"</script>'),
    '**bold** &amp; &lt;script&gt;"text"&lt;/script&gt;'
  );
  assert.equal(safeText(''), '');
});

test('plainText escapes Markdown punctuation and HTML and flattens line breaks', () => {
  const punctuation = '\\`*_{}[]()#!|';
  assert.equal(
    plainText(punctuation),
    [...punctuation].map((character) => `\\${character}`).join('')
  );
  assert.equal(
    plainText('<Alice> & Bob\r\n\nCarol\rDave'),
    '&lt;Alice&gt; &amp; Bob Carol Dave'
  );
  assert.equal(plainText(''), '');
});

test('encodeCharacter uses uppercase hexadecimal escapes', () => {
  assert.equal(encodeCharacter('('), '%28');
  assert.equal(encodeCharacter(')'), '%29');
  assert.equal(encodeCharacter('*'), '%2A');
  assert.equal(encodeCharacter(' '), '%20');
});

test('encodeSegment encodes path separators and Markdown-unsafe characters', () => {
  assert.equal(
    encodeSegment("release/1 !'()*<>[]?#&"),
    'release%2F1%20%21%27%28%29%2A%3C%3E%5B%5D%3F%23%26'
  );
  assert.equal(encodeSegment('café'), 'caf%C3%A9');
  assert.equal(encodeSegment('v1.2.3-alpha_1~'), 'v1.2.3-alpha_1~');
  assert.equal(encodeSegment(''), '');
});
