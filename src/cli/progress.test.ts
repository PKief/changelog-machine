import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import type { WriteStream } from 'node:tty';
import { withProgress } from './progress.js';

function terminal(isTTY: boolean) {
  const stream = Object.assign(new PassThrough(), { isTTY });
  let text = '';
  stream.on('data', (chunk) => {
    text += chunk.toString();
  });
  return { output: stream as unknown as WriteStream, text: () => text };
}

test('quick operations and redirected output stay silent', async () => {
  for (const isTTY of [true, false]) {
    const target = terminal(isTTY);
    assert.equal(
      await withProgress('Reading Git releases', async () => 42, target.output),
      42
    );
    assert.equal(target.text(), '');
  }
});

test('long terminal operations animate and clear the indicator', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const target = terminal(true);
  let finish!: (value: number) => void;
  let updateLabel!: (label: string) => void;
  const result = withProgress(
    'Reading Git releases',
    (update) => {
      updateLabel = update;
      return new Promise<number>((resolve) => {
        finish = resolve;
      });
    },
    target.output
  );
  context.mock.timers.tick(200);
  assert.match(target.text(), /\| Reading Git releases/);
  context.mock.timers.tick(100);
  assert.match(target.text(), /\/ Reading Git releases/);
  updateLabel('Contributors: 1/20 checked, 1 resolved, 1 requests');
  context.mock.timers.tick(100);
  assert.match(
    target.text(),
    /Contributors: 1\/20 checked, 1 resolved, 1 requests/
  );
  finish(42);
  assert.equal(await result, 42);
  assert.ok(target.text().endsWith('\u001b[1G\u001b[2K'));
  const completed = target.text();
  context.mock.timers.tick(1000);
  assert.equal(target.text(), completed);
});

test('failed operations clear the indicator and preserve the error', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const target = terminal(true);
  let fail!: (error: Error) => void;
  const result = withProgress(
    'Reading Git releases',
    () =>
      new Promise((_, reject) => {
        fail = reject;
      }),
    target.output
  );
  context.mock.timers.tick(200);
  const failure = new Error('Git failed');
  fail(failure);
  await assert.rejects(result, (error) => error === failure);
  assert.ok(target.text().endsWith('\u001b[1G\u001b[2K'));
  const completed = target.text();
  context.mock.timers.tick(1000);
  assert.equal(target.text(), completed);
});
