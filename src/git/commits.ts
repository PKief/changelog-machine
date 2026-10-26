import type { Commit } from '../types.js';
import { git } from './command.js';

export async function readCommits(
  range: string,
  cwd?: string
): Promise<Commit[]> {
  const format = '%H%x00%aN%x00%aE%x00%s%x00%b';
  const fieldsPerCommit = 5;
  const output = await git(
    ['log', '--no-merges', '-z', `--format=${format}`, range, '--'],
    cwd
  );
  if (!output) return [];
  const fields = output.split('\0');
  if (fields.pop() !== '' || fields.length % fieldsPerCommit !== 0) {
    throw new Error('Git returned an invalid NUL-delimited commit log.');
  }
  const commits: Commit[] = [];
  for (let index = 0; index < fields.length; index += fieldsPerCommit) {
    const [hash, name, email, subject, body] = fields.slice(
      index,
      index + fieldsPerCommit
    );
    commits.push({ hash, name, email, subject, body });
  }
  return commits;
}
