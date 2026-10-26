import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type FilePlan = { path: string; content: string };

async function fileMode(path: string): Promise<number | undefined> {
  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error(`Not a regular file: ${path}`);
    return info.mode;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return undefined;
  }
}

export async function apply(files: FilePlan[]): Promise<void> {
  const staged: { path: string; temporary: string }[] = [];
  try {
    for (const file of files) {
      await mkdir(dirname(file.path), { recursive: true });
      const mode = await fileMode(file.path);
      const temporary = `${file.path}.${randomUUID()}.tmp`;
      staged.push({ path: file.path, temporary });
      await writeFile(temporary, file.content, { flag: 'wx', mode });
    }
    for (const file of staged) await rename(file.temporary, file.path);
  } finally {
    await Promise.all(
      staged.map((file) => rm(file.temporary, { force: true }))
    );
  }
  for (const file of files) console.error(`Updated ${file.path}`);
}
