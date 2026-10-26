# Changelog Machine

A small, offline conventional changelog and package-version generator. Written in TypeScript, with **no production npm dependencies**. Requires **Node 22+** and **Git**.

## Usage

```sh
npx changelog-machine --full
```

Run inside your repository. By default, the CLI creates `CHANGELOG.md` if missing; otherwise it adds newer releases and refreshes `Unreleased`, preserving older release sections and your introduction. `--full` explicitly replaces the entire file using reachable version tags and conventional commits, newest releases first. Preview with `--dry-run` before writing.

```sh
changelog-machine                         # Create or incrementally update CHANGELOG.md
changelog-machine --dry-run               # Preview the incremental result
changelog-machine --full --dry-run        # Preview the entire changelog
changelog-machine --full --output docs/CHANGELOG.md
changelog-machine --full --include-non-conventional
changelog-machine --bump --dry-run        # Show the recommended version
changelog-machine --bump                  # Update package metadata only
changelog-machine --bump --full           # Update metadata and regenerate history
```

`--bump --full` still labels untagged changes `Unreleased`: bumping does not create a release tag.

### Options

| Option | Behavior |
| --- | --- |
| `--full` | Replace the complete changelog (default: `CHANGELOG.md`) |
| `--bump` | Infer and apply a package-version bump |
| `--dry-run` | Preview without writing files |
| `--output <path>` | Change the destination (also works for incremental updates) |
| `--repo-url <url>` | Override remote detection with an HTTPS URL |
| `--resolve-contributors` | Opt in to verified contributor-profile lookups over the network |
| `--include-non-conventional` | Include other commits under Other Changes |
| `--help`, `-h` | Display usage |
| `--version`, `-v` | Display the tool version |

Long-running Git reads and contributor lookups show an animated progress indicator on interactive stderr. Fast operations and non-interactive output stay silent; stdout remains clean for `--dry-run` output.

There is no configuration file. Network access is disabled unless `--resolve-contributors` is requested. Nothing automatically fetches Git history, commits, tags, pushes, runs npm lifecycle hooks, or publishes.

### Incremental updates and scaling

The newest documented release heading is the update boundary. Only commits and release sections after that tag are loaded and generated; the existing `Unreleased` section is replaced, never duplicated. Historical release sections are preserved verbatim, including any old email addresses. Use `--full` to apply current formatting and email redaction throughout.

Tag metadata is read in one Git command and release order is found with a topological traversal, avoiding pairwise comparisons between every tag. Incremental traversal is bounded to the documented tag through HEAD; contributor lookups run only for newly generated sections. Unchanged files are not rewritten. Full generation still reads historical commit ranges per release. Git may traverse older ancestry internally for validation; there is no disk cache or extra state file.

Existing files must use `# Changelog` and `## <version-tag>` / `## Unreleased` headings. Unknown formatting, duplicate release headings, and missing or unreachable boundary tags fail instead of silently overwriting content. Use `--full` when intentionally changing history or migrating another format. Incremental updates add newer releases; they do not backfill holes among already documented older releases.

## Changelog format

```md
# Changelog

## v2.0.0

[compare changes](https://github.com/example/project/compare/v1.0.0...v2.0.0)

### Breaking Changes

- **api:** Remove deprecated options

### Enhancements

- Add new icons ([#42](https://github.com/example/project/pull/42))

### Contributors

- Philipp Kief
```

Sections contain no added emojis. Conventional types map to Enhancements (`feat`), Fixes (`fix`), Performance (`perf`), Documentation, Refactors, Tests, Build, CI, Chores and Reverts. Unknown conventional types go under Other Changes. Breaking changes have their own section, including multiline breaking-change notes.

Within each category, commits appear oldest first and newest last, using Git ancestry order. Releases remain newest first. Run `--full` to apply this ordering to existing historical sections.

Release bookkeeping messages such as `release: v1.2.3`, `chore(release): v1.2.3`, and `chore: release v1.2.3` are excluded, including with `--include-non-conventional`. Release tooling changes and unrelated chores remain visible. Run `--full` to remove previously generated release entries from historical sections.

Scopes and description Markdown are preserved. Trailing `(#123)` references link to pull requests; otherwise entries link to their commit. Supported public hosts are GitHub, GitLab and Bitbucket. Unsupported hosts produce plain references. Contributor names come from included commits, honoring Git `.mailmap`. Emails are never used as contributor labels; email-only names become `Unknown contributor`. Recognizable plain and URL-encoded email addresses are redacted throughout generated Markdown, including descriptions and breaking notes. Merge commits are excluded; squash commit messages are supported.

### Optional contributor profiles

```sh
changelog-machine --full --resolve-contributors
```

Verified profiles appear alongside Git author names, for example `Philipp Kief ([@PKief](https://github.com/PKief))`. GitHub commit authors and Bitbucket associated users are resolved using their public APIs. GitLab's commit API does not reliably associate authors with accounts, so GitLab retains Git author names rather than guessing or substituting merge-request authors.

For authenticated lookups, set `GH_TOKEN` or `GITHUB_TOKEN` for GitHub, or `BITBUCKET_TOKEN` for a Bitbucket bearer access token. Tokens are never written to the changelog. Requests have a five-second timeout, run at most three concurrently, and reuse results for duplicate commits within a run. Authentication failures and rate limits stop queued requests; missing identities and network failures fall back to Git author names without exposing emails. On large histories, rate limits may leave many authors unresolved. Enriched results can change over time; offline generation remains deterministic.

API callers can use `resolveContributors(commits, repositoryUrl)` and pass its result as `contributors` to `renderMarkdown`. Explicit GitLab profiles can also be supplied through this API; there is no automatic GitLab username lookup.

Tags may be `1.2.3` or `v1.2.3`, including SemVer prerelease/build suffixes. Only tags reachable from HEAD are considered. Release order follows ancestry rather than timestamps. Ambiguous tag chains and multiple version tags on one commit fail explicitly. Shallow repositories must first be completed by the user (`git fetch --unshallow --tags`). Empty repositories return an empty changelog. Non-conventional history is excluded unless requested, so older releases can have empty sections.

## Version policy

The highest-impact conventional commit since the latest release determines the bump:

| Commits | Result |
| --- | --- |
| `feat!:`, `fix(scope)!:`, `BREAKING CHANGE:` or `BREAKING-CHANGE:` footer | Major |
| `feat:` | Minor |
| `fix:` or `perf:` | Patch |
| Other types only | No bump |

Breaking changes always mean a major bump, even on `0.x`. With no tags, all history is analyzed against the current package version. When a release tag exists, it must match `package.json`; a mismatch fails, preventing repeated application of an unreleased bump. Prerelease version promotion is not supported by `--bump`.

`--bump` updates `package.json` plus an existing npm `package-lock.json` or `npm-shrinkwrap.json` (lockfile versions 1–3). Only root version fields change, not dependency versions. Yarn/pnpm lockfiles and conflicting npm lockfiles are rejected before writing. Workspaces and independent package release streams are not supported.

Writes are staged before replacement and each individual file is replaced atomically. Replacement of several files is not a cross-file transaction; review changes before committing.

## API

```ts
import { getReleases, renderMarkdown, getRepositoryUrl, planVersion } from 'changelog-machine';

const cwd = process.cwd();
const releases = await getReleases(cwd);
const markdown = renderMarkdown(releases, {
  repositoryUrl: await getRepositoryUrl(cwd),
});
const unreleased = releases.find(release => release.tag === 'Unreleased');
const latestTag = releases.find(release => release.tag !== 'Unreleased')?.tag;
const versionPlan = await planVersion(unreleased?.commits ?? [], latestTag, cwd);
```

The API returns strings and version plans without writing files. Exports also include `parseCommit`, `recommendedBump`, and TypeScript types. The package is ESM-only. This redesign replaces the old `printMarkdown` API and configuration format and should be released as a major version.

## Development and publishing

```sh
npm ci
npm run build
npm test
npm run lint
npm pack --dry-run
```

Tests live next to their source modules as `name.test.ts` and import application functions only from the matching module. They use Node's built-in test runner and local temporary Git repositories.

The root `tsconfig.json` type-checks both source and tests for editor support. `tsconfig.build.json` excludes tests from published builds; `tsconfig.test.json` compiles everything into the ignored `.test-build/` directory for execution. No nested TypeScript configurations are needed.

TypeScript 7 and Node type definitions are development dependencies only; published code is ordinary JavaScript.

The `files` allowlist in `package.json` replaces `.npmignore`: only compiled `lib/`, executable `bin/`, and the license are explicitly included. npm also includes package metadata and README. `prepack` builds before `npm pack` or `npm publish`; source, tests, and development tooling are not shipped. Publishing CI runs only when a matching `v<package-version>` tag is pushed. After successful npm publication, it creates a GitHub Release with notes generated for that tag only; prerelease tags are marked as prereleases.
