import { clearLine, cursorTo } from 'node:readline';
import type { WriteStream } from 'node:tty';

const frames = ['|', '/', '-', '\\'];
const refreshIntervalMs = 100;
const displayDelayMs = 200;

export async function withProgress<T>(
  label: string,
  task: (update: (label: string) => void) => Promise<T>,
  output: WriteStream = process.stderr
): Promise<T> {
  if (!output.isTTY) return task(() => {});
  const update = (message: string) => {
    label = message;
  };

  let frame = 0;
  let visible = false;
  let animation: NodeJS.Timeout | undefined;
  const render = () => {
    cursorTo(output, 0);
    clearLine(output, 0);
    output.write(`${frames[frame++ % frames.length]} ${label}`);
    visible = true;
  };
  const delay = setTimeout(() => {
    render();
    animation = setInterval(render, refreshIntervalMs);
    animation.unref();
  }, displayDelayMs);
  delay.unref();

  try {
    return await task(update);
  } finally {
    clearTimeout(delay);
    clearInterval(animation);
    if (visible) {
      cursorTo(output, 0);
      clearLine(output, 0);
    }
  }
}
