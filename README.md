# Changelog Machine

Conventional changelogs and version bumps, with **zero production dependencies**.
Requires **Node 22+** and **Git**.

## Quick start

Run inside your repository:

```sh
npx changelog-machine                 # Create or update CHANGELOG.md
npx changelog-machine --dry-run       # Preview changes
npx changelog-machine --full          # Rebuild from scratch
npx changelog-machine --bump --dry-run # Preview the next version
npx changelog-machine --bump           # Update package metadata only
```

- **Default:** add newer releases, refresh `Unreleased`, preserve older sections.
- **Missing file:** generate the entire history.
- **`--full`:** replace all content, including manual edits.
- No automatic Git fetches, commits, tags, pushes, or publishing.

## Options

| Option | Purpose |
| --- | --- |
| `--full` | Rebuild the entire changelog |
| `--bump` | Infer and apply a version bump |
| `--dry-run` | Preview without writing |
| `--output <path>` | Set the changelog destination |
| `--repo-url <url>` | Override repository links with an HTTPS URL |
| `--resolve-contributors` | Look up verified contributor profiles |
| `--include-non-conventional` | Include other commits under Other Changes |
| `--help`, `-h` | Show usage |
| `--version`, `-v` | Show the tool version |

Long operations show progress in interactive terminals. Redirected output stays clean.

## Changelog format

```md
# Changelog

## v2.0.0

[compare changes](https://github.com/example/project/compare/v1.0.0...v2.0.0)

### Enhancements

- **icons:** Add new icons ([#42](https://github.com/example/project/pull/42))

### Contributors

- Philipp Kief
```

- Releases: **newest first**. Commits within categories: **oldest first**.
- Messages start uppercase; scopes and Markdown are preserved.
- Separate sections for breaking changes, features, fixes, and other commit types.
- Release bookkeeping commits are excluded; merge commits are skipped.
- GitHub, GitLab, and Bitbucket links are supported.
- Contributor names honor `.mailmap`; recognizable emails are redacted.

Use `--full` to apply formatting changes to older sections.

## Incremental updates

The newest documented tag is the update boundary. Only newer commit ranges are
loaded; older sections stay untouched. Unchanged files are not rewritten.

- Supports `1.2.3` / `v1.2.3` tags, including prereleases and build metadata.
- Uses Git ancestry, not tag dates; avoids quadratic tag comparisons.
- Requires `# Changelog` and `## <tag>` / `## Unreleased` headings.
- Invalid formatting, ambiguous tags, or missing boundaries fail safely.
- Does not backfill gaps between older documented releases.
- Historical emails remain untouched; `--full` redacts generated history.

Shallow clone? Run `git fetch --unshallow --tags` first.

## Contributor profiles

```sh
changelog-machine --resolve-contributors
```

Adds verified profile links next to Git author names. Network access is **opt-in**.

| Provider | Resolution | Optional token |
| --- | --- | --- |
| GitHub | Associated commit author | `GH_TOKEN` or `GITHUB_TOKEN` |
| Bitbucket | Associated user | `BITBUCKET_TOKEN` (bearer token) |
| GitLab | Git author name only | — |

Unresolved users fall back to Git author names, never emails. Email-only names
become `Unknown contributor`. No username guessing or email searches.

Lookups use five-second timeouts, three concurrent requests, and per-run
commit deduplication. Rate limits stop queued requests; enriched results may vary.

## Version bumps

The highest-impact commit since the latest release wins:

| Commit | Bump |
| --- | --- |
| `!`, `BREAKING CHANGE:`, or `BREAKING-CHANGE:` | Major, even on `0.x` |
| `feat:` | Minor |
| `fix:` or `perf:` | Patch |
| Other types | None |

- Updates `package.json` and an existing npm lockfile (versions 1–3).
- Leaves dependency versions unchanged.
- Requires the latest tag to match the package version; repeated bumps fail.
- Without tags, analyzes all commits against the current package version.
- Prerelease promotion, Yarn/pnpm lockfiles, and workspaces are unsupported.
- `--bump --full` also rebuilds the changelog; untagged changes stay `Unreleased`.

Files are staged first and replaced atomically per file—not as a multi-file transaction.

## API

```ts
import {
  getReleases,
  getRepositoryUrl,
  renderMarkdown,
  resolveContributors,
} from 'changelog-machine';

const releases = await getReleases();
const repositoryUrl = await getRepositoryUrl();
const markdown = renderMarkdown(releases, { repositoryUrl });

// Optional network enrichment
const contributors = await resolveContributors(
  releases.flatMap(release => release.commits),
  repositoryUrl,
);
const enriched = renderMarkdown(releases, { repositoryUrl, contributors });
```

Also exports `parseCommit`, `recommendedBump`, `planVersion`, and TypeScript types.
Pass a boundary tag to `getReleases(cwd, tag)` for incremental history.
The API does not write files. Explicit GitLab profiles can be supplied to the renderer.

**ESM-only.** Replaces the old `printMarkdown` API and JSON configuration; requires a major release.

## Development and publishing

```sh
npm ci
npm run build
npm test
npm run lint
npm pack --dry-run
```

- Tests live beside source as `name.test.ts`, using Node's test runner.
- Root TypeScript config covers source and tests; build config excludes tests.
- TypeScript 7 is development-only; npm ships compiled JavaScript and types.
- `package.json`'s `files` allowlist replaces `.npmignore`; `prepack` builds automatically.
- Push a matching `v<package-version>` tag to publish to npm and create a GitHub Release.
