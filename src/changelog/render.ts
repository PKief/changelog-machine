import { parseCommit } from '../commits/parse.js';
import { redactEmails } from '../contributors/privacy.js';
import type { Options, ParsedCommit, Release } from '../types.js';
import { contributorLines } from './contributors.js';
import type { Repository } from './links.js';
import { commitReference, compareUrl, repositoryBase } from './links.js';
import { capitalizeMessage, plainText, safeText } from './text.js';

const groups: ReadonlyArray<readonly [string, string]> = [
  ['breaking', 'Breaking Changes'],
  ['feat', 'Enhancements'],
  ['fix', 'Fixes'],
  ['perf', 'Performance'],
  ['docs', 'Documentation'],
  ['refactor', 'Refactors'],
  ['test', 'Tests'],
  ['build', 'Build'],
  ['ci', 'CI'],
  ['chore', 'Chores'],
  ['revert', 'Reverts'],
  ['other', 'Other Changes'],
];

const noteLineBreakPattern = /\r?\n/;

function entry(commit: ParsedCommit, repository?: Repository): string[] {
  const scope = commit.scope ? `**${plainText(commit.scope)}:** ` : '';
  const reference = commitReference(commit, repository);
  const lines = [
    `- ${scope}${safeText(capitalizeMessage(commit.description))} ${reference}`,
  ];
  for (const note of commit.breakingNotes) {
    const parts = safeText(capitalizeMessage(note)).split(noteLineBreakPattern);
    lines.push(
      `  - ${parts[0]}`,
      ...parts.slice(1).map((line) => `    ${line}`)
    );
  }
  return lines;
}

export function renderMarkdown(
  releases: Release[],
  options: Options = {}
): string {
  const repository = repositoryBase(options.repositoryUrl);
  const lines = ['# Changelog'];
  for (const release of releases) {
    lines.push('', `## ${plainText(release.tag)}`);
    if (repository && release.previousTag) {
      lines.push(
        '',
        `[compare changes](${compareUrl(repository, release.previousTag, release.tag)})`
      );
    }
    const commits = release.commits
      .map((commit) => parseCommit(commit, options.includeNonConventional))
      .filter((commit): commit is ParsedCommit => commit !== undefined);
    const grouped = new Map<string, ParsedCommit[]>();
    for (const commit of commits) {
      const key = commit.breaking
        ? 'breaking'
        : groups.some(([type]) => type === commit.type)
          ? commit.type
          : 'other';
      const list = grouped.get(key) ?? [];
      list.push(commit);
      grouped.set(key, list);
    }
    for (const [key, title] of groups) {
      const entries = grouped.get(key);
      if (!entries?.length) continue;
      lines.push('', `### ${title}`, '');
      for (const commit of entries) lines.push(...entry(commit, repository));
    }
    const contributors = contributorLines(commits, options);
    if (contributors.length) {
      lines.push('', '### Contributors', '', ...contributors);
    }
  }
  return redactEmails(`${lines.join('\n')}\n`);
}
