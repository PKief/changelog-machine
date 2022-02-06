import { exec } from 'child_process';
import { readFile, writeFile } from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);
const writeFileAsync = promisify(writeFile);
const readFileAsync = promisify(readFile);

export { execAsync, writeFileAsync, readFileAsync };
