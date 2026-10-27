import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const help = `Usage: changelog-machine [options]

Updates missing releases and refreshes Unreleased in CHANGELOG.md by default.
Creates a complete changelog when the file does not exist.

  --full                      Replace the entire CHANGELOG.md from Git history
  --bump                      Infer and update the package version (files only)
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
  return parseArgs({
    args,
    options: {
      full: { type: 'boolean' },
      bump: { type: 'boolean' },
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
}

export function validateOptions(flags: Flags): void {
  if (flags.output && flags.bump && !flags.full)
    throw new Error('--output requires changelog generation, not --bump alone');
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
