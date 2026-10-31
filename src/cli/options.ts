import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { validateBumpCommand } from '../version/command.js';

const help = `Usage: changelog-machine [options]

Updates missing releases and refreshes Unreleased in CHANGELOG.md by default.
Creates a complete changelog when the file does not exist.

  --full                      Replace the entire CHANGELOG.md from Git history
  --bump                      Infer version; update package metadata and changelog
  --bump-command <command>    Trusted shell command containing {version} (requires --bump)
  --dry-run                   Preview without writing any files
  --output <path>              Changelog destination (default: CHANGELOG.md)
  --repo-url <url>             Repository URL for links
  --resolve-contributors      Look up verified hosting profiles (uses network)
  --include-non-conventional  Include other commits under Other Changes
  --help                      Show help
  --version                   Show this tool's version

Requires Node 24+ and Git. Never fetches, commits, tags, pushes or publishes.
`;

export type Flags = ReturnType<typeof parseFlags>;

export function parseFlags(args: string[]) {
  const flags = parseArgs({
    args,
    options: {
      full: { type: 'boolean' },
      bump: { type: 'boolean' },
      'bump-command': { type: 'string' },
      'dry-run': { type: 'boolean' },
      output: { type: 'string' },
      'repo-url': { type: 'string' },
      'resolve-contributors': { type: 'boolean' },
      'include-non-conventional': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
    allowPositionals: false,
  }).values;
  if (flags['bump-command'] !== undefined) {
    if (!flags.bump) throw new Error('--bump-command requires --bump');
    validateBumpCommand(flags['bump-command']);
  }
  return flags;
}

export async function showInformation(flags: Flags): Promise<boolean> {
  if (flags.help) {
    process.stdout.write(help);
    return true;
  }
  if (flags.version) {
    const pkg = JSON.parse(
      await readFile(new URL('../../package.json', import.meta.url), 'utf8')
    );
    console.log(pkg.version);
    return true;
  }
  return false;
}
