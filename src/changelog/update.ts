import { isVersionTag } from '../git/tags.js';

export interface ExistingChangelog {
  boundaryTag?: string;
  prefix: string;
  history: string;
}

interface Heading {
  title: string;
  start: number;
}

function headings(content: string): Heading[] {
  const result: Heading[] = [];
  let offset = 0;
  let fence: { character: string; length: number } | undefined;

  for (const line of content.match(/[^\n]*(?:\n|$)/g) ?? []) {
    if (!line) continue;
    const text = line.replace(/\r?\n$/, '');
    const marker = text.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (
        marker &&
        marker[1][0] === fence.character &&
        marker[1].length >= fence.length
      ) {
        fence = undefined;
      }
    } else if (marker) {
      fence = { character: marker[1][0], length: marker[1].length };
    } else if (/^##(?:\s|$)/.test(text)) {
      const heading = text.match(/^##\s+(.+?)\s*#*\s*$/);
      result.push({ title: heading?.[1].trim() ?? '', start: offset });
    }
    offset += line.length;
  }

  return result;
}

function formatError(detail: string): Error {
  return new Error(
    `Cannot update changelog: ${detail}. Use --full to regenerate it.`
  );
}

function removeSection(
  content: string,
  sectionHeadings: Heading[],
  index: number
): string {
  const start = sectionHeadings[index].start;
  const end = sectionHeadings[index + 1]?.start ?? content.length;
  return content.slice(0, start) + content.slice(end);
}

function validateTitle(content: string): void {
  if (!/^# Changelog(?:\r?\n|$)/.test(content)) {
    throw formatError('expected a # Changelog title');
  }
}

function validateSections(sectionHeadings: Heading[]): void {
  let foundRelease = false;
  let foundUnreleased = false;
  const tags = new Set<string>();

  for (const heading of sectionHeadings) {
    if (heading.title === 'Unreleased') {
      if (foundUnreleased) throw formatError('duplicate Unreleased section');
      if (foundRelease)
        throw formatError('Unreleased section must precede tagged releases');
      foundUnreleased = true;
    } else if (!isVersionTag(heading.title)) {
      throw formatError(`unrecognized release heading "${heading.title}"`);
    } else {
      if (tags.has(heading.title))
        throw formatError(`duplicate release tag "${heading.title}"`);
      tags.add(heading.title);
      foundRelease = true;
    }
  }
}

function removeUnreleased(content: string, sectionHeadings: Heading[]): string {
  const index = sectionHeadings.findIndex(
    (heading) => heading.title === 'Unreleased'
  );
  return index < 0 ? content : removeSection(content, sectionHeadings, index);
}

export function parseChangelog(content: string): ExistingChangelog {
  validateTitle(content);
  const sectionHeadings = headings(content);
  validateSections(sectionHeadings);
  const firstReleaseIndex = sectionHeadings.findIndex((heading) =>
    isVersionTag(heading.title)
  );
  const firstRelease = sectionHeadings[firstReleaseIndex];
  const prefixEnd = firstRelease?.start ?? content.length;
  const prefix = removeUnreleased(
    content.slice(0, prefixEnd),
    sectionHeadings.filter((heading) => heading.start < prefixEnd)
  );

  if (!firstRelease) return { prefix, history: '' };
  return {
    boundaryTag: firstRelease.title,
    prefix,
    history: content.slice(firstRelease.start),
  };
}

function joinAtBoundary(left: string, right: string): string {
  if (!left) return right;
  if (!right) return left;
  return `${left.replace(/\n+$/, '')}\n\n${right.replace(/^\n+/, '')}`;
}

function generatedSections(
  content: string,
  sectionHeadings: Heading[]
): string {
  const firstSection = sectionHeadings[0]?.start;
  if (firstSection === undefined) return '';
  return content.slice(firstSection);
}

export function mergeChangelog(
  existing: ExistingChangelog | undefined,
  generated: string
): string {
  validateTitle(generated);
  const generatedHeadings = headings(generated);
  validateSections(generatedHeadings);
  const parsed = parseChangelog(generated);
  const generatedPrefix = generated.slice(
    0,
    generatedHeadings[0]?.start ?? generated.length
  );
  const prefix = existing?.prefix ?? generatedPrefix;
  let freshSections = generatedSections(generated, generatedHeadings);

  if (existing?.boundaryTag) {
    const duplicate = generatedHeadings.findIndex(
      (heading) => heading.title === existing.boundaryTag
    );
    if (duplicate >= 0) {
      const firstSection = generatedHeadings[0]?.start;
      freshSections =
        firstSection === undefined ||
        generatedHeadings[duplicate].start <= firstSection
          ? ''
          : generated.slice(firstSection, generatedHeadings[duplicate].start);
    }
  }

  const history = joinAtBoundary(freshSections, existing?.history ?? '');
  return joinAtBoundary(prefix, history) || parsed.prefix;
}
