import type { ParsedCommit } from '../types.js';
import { encodeCharacter, encodeSegment, plainText } from './text.js';

const trailingSlashesPattern = /\/+$/;
const gitSuffixPattern = /\.git$/;
const urlUnsafeCharactersPattern = /[\s()<>\[\]]/g;

const repositoryRoutes = {
  'github.com': {
    compare: '/compare/',
    commit: '/commit/',
    issue: '/issues/',
    pullRequest: '/pull/',
  },
  'gitlab.com': {
    compare: '/-/compare/',
    commit: '/-/commit/',
    issue: '/-/issues/',
    pullRequest: '/-/merge_requests/',
  },
  'bitbucket.org': {
    compare: '/branches/compare/',
    commit: '/commits/',
    issue: '/issues/',
    pullRequest: '/pull-requests/',
  },
};

type RepositoryHost = keyof typeof repositoryRoutes;
export type Repository = { base: string; host: RepositoryHost };

export function repositoryBase(value?: string): Repository | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    if (url.username || url.password) return undefined;
    const host = url.hostname;
    if (
      host !== 'github.com' &&
      host !== 'gitlab.com' &&
      host !== 'bitbucket.org'
    )
      return undefined;
    url.search = '';
    url.hash = '';
    const base = url
      .toString()
      .replace(trailingSlashesPattern, '')
      .replace(gitSuffixPattern, '')
      .replace(urlUnsafeCharactersPattern, encodeCharacter);
    return { base, host };
  } catch {
    return undefined;
  }
}

export function compareUrl(
  repository: Repository,
  baseTag: string,
  targetTag: string
): string {
  const base = encodeSegment(baseTag);
  const target = encodeSegment(targetTag);
  const comparison =
    repository.host === 'bitbucket.org'
      ? `${target}..${base}`
      : `${base}...${target}`;
  return `${repository.base}${repositoryRoutes[repository.host].compare}${comparison}`;
}

const inlineCodePattern = /(`+)[\s\S]*?\1/;
const markdownLinkPattern = /!?\[[^\]\n]*\]\([^\n]*?\)/;
const plainUrlPattern = /https?:\/\/[^\s)]+/;
const issueNumberPattern = /(?<![\w/#\\])#([1-9]\d*)\b/;
const protectedMarkdownOrIssue = new RegExp(
  [inlineCodePattern, markdownLinkPattern, plainUrlPattern, issueNumberPattern]
    .map((pattern) => pattern.source)
    .join('|'),
  'g'
);

export function linkIssueReferences(
  message: string,
  repository?: Repository
): string {
  if (!repository) return message;
  const issueUrl = `${repository.base}${repositoryRoutes[repository.host].issue}`;
  return message.replace(protectedMarkdownOrIssue, (match, _code, issue) =>
    issue ? `[#${issue}](${issueUrl}${issue})` : match
  );
}

export function commitReference(
  commit: ParsedCommit,
  repository?: Repository
): string {
  const label = commit.pr
    ? `#${commit.pr}`
    : plainText(commit.hash.slice(0, 8));
  if (!repository) return `(${label})`;
  const routes = repositoryRoutes[repository.host];
  const path = commit.pr ? routes.pullRequest : routes.commit;
  const identifier = encodeSegment(commit.pr ?? commit.hash);
  return `([${label}](${repository.base}${path}${identifier}))`;
}
