import { spawn } from 'node:child_process';

export class GitError extends Error {
  readonly exitCode: number | null;

  constructor(message: string, exitCode: number | null = null) {
    super(message);
    this.name = 'GitError';
    this.exitCode = exitCode;
  }
}

export async function git(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: Object.assign({}, process.env, { ['GIT_TERMINAL_PROMPT']: '0' }),
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    const context = `git ${args.map((arg) => JSON.stringify(arg)).join(' ')} in ${cwd ?? process.cwd()}`;
    child.on('error', (error) => {
      reject(
        new GitError(
          `Could not run ${context}: ${error.message}. Check that Git is installed and the working directory exists.`
        )
      );
    });
    child.on('close', (code, signal) => {
      if (code === 0) resolve(stdout);
      else
        reject(
          new GitError(
            `${context} failed (${signal ? `signal ${signal}` : `exit ${code}`}): ${stderr.trim() || 'no diagnostic output'}`,
            code
          )
        );
    });
  });
}
