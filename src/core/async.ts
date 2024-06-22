import { exec } from 'child_process';
import { mkdir, readFile, writeFile, existsSync } from 'fs';
import { dirname } from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);
const writeFileAsync = promisify(writeFile);
const readFileAsync = promisify(readFile);
const mkdirAsync = promisify(mkdir);

const outputFileAsync = async (path: string, contents: string) => {
  await mkdirAsync(dirname(path), { recursive: true });
  await writeFileAsync(path, contents);
};

const checkPackageJsonExists = (): boolean => {
  return existsSync('package.json');
};

export { execAsync, writeFileAsync, readFileAsync, outputFileAsync, checkPackageJsonExists };
