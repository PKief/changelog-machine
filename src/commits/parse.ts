import { isVersionTag } from '../git/tags.js';
import type { Commit, ParsedCommit } from '../types.js';

const conventionalHeaderPattern =
  /^([A-Za-z][A-Za-z0-9-]*)(?:\(([^()\r\n]+)\))?(!)?:\s+(.+)$/;
const breakingNotePattern = /^BREAKING[ -]CHANGE:\s*(.*)$/;
const breakingFooterPattern = /^BREAKING[ -]CHANGE:/m;
const footerTokenPattern = /^[A-Za-z][A-Za-z0-9-]*/;
const footerSeparatorPattern = /^(?::\s|\s+#)/;
const pullRequestSuffixPattern = /\s+\(#(\d+)\)$/;
const lineBreakPattern = /\r?\n/;

function isFooter(line: string): boolean {
  const token = footerTokenPattern.exec(line);
  return Boolean(
    token && footerSeparatorPattern.test(line.slice(token[0].length))
  );
}

function breakingNotes(body: string): string[] {
  const notes: string[] = [];
  let noteLines: string[] | undefined;
  const finishNote = (): void => {
    if (noteLines) {
      const note = noteLines.join('\n').trim();
      if (note) notes.push(note);
    }
    noteLines = undefined;
  };

  for (const line of body.split(lineBreakPattern)) {
    const breakingMatch = breakingNotePattern.exec(line);
    if (breakingMatch) {
      finishNote();
      noteLines = [breakingMatch[1]];
    } else if (isFooter(line)) {
      finishNote();
    } else if (noteLines) {
      noteLines.push(line);
    }
  }
  finishNote();
  return notes;
}

function isReleaseCommit(
  type: string,
  scope: string | undefined,
  description: string
): boolean {
  const version = description.startsWith('release ')
    ? description.slice('release '.length)
    : description;
  const releaseType = type === 'release';
  const releaseChore =
    type === 'chore' &&
    (scope === 'release' || description.startsWith('release '));
  return (releaseType || releaseChore) && isVersionTag(version);
}

export function parseCommit(
  commit: Commit,
  includeNonConventional = false
): ParsedCommit | undefined {
  const headerMatch = conventionalHeaderPattern.exec(commit.subject.trim());
  if (!headerMatch && !includeNonConventional) return undefined;

  let description = headerMatch ? headerMatch[4] : commit.subject.trim();
  const pullRequestMatch = pullRequestSuffixPattern.exec(description);
  if (pullRequestMatch)
    description = description.slice(0, pullRequestMatch.index).trimEnd();
  if (
    headerMatch &&
    isReleaseCommit(
      headerMatch[1].toLowerCase(),
      headerMatch[2]?.toLowerCase(),
      description
    )
  )
    return undefined;
  const notes = breakingNotes(commit.body);
  return {
    ...commit,
    type: headerMatch ? headerMatch[1].toLowerCase() : 'other',
    ...(headerMatch?.[2] ? { scope: headerMatch[2] } : {}),
    description,
    breaking:
      Boolean(headerMatch?.[3]) ||
      notes.length > 0 ||
      breakingFooterPattern.test(commit.body),
    breakingNotes: notes,
    ...(pullRequestMatch ? { pr: pullRequestMatch[1] } : {}),
  };
}

export function recommendedBump(
  commits: Commit[]
): 'major' | 'minor' | 'patch' | undefined {
  let bump: 'minor' | 'patch' | undefined;
  for (const commit of commits) {
    const parsed = parseCommit(commit);
    if (!parsed) continue;
    if (parsed.breaking) return 'major';
    if (parsed.type === 'feat') bump = 'minor';
    else if ((parsed.type === 'fix' || parsed.type === 'perf') && !bump)
      bump = 'patch';
  }
  return bump;
}
