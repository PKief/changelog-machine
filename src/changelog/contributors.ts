import { authorName } from '../contributors/privacy.js';
import { validateProfile } from '../contributors/profile.js';
import type { Options, ParsedCommit } from '../types.js';
import { plainText } from './text.js';

function profileForCommit(commit: ParsedCommit, options: Options) {
  const profile = options.contributors?.[commit.hash];
  if (!profile || !options.repositoryUrl) return undefined;
  try {
    const host = new URL(options.repositoryUrl).hostname;
    if (!['github.com', 'bitbucket.org', 'gitlab.com'].includes(host))
      return undefined;
    return validateProfile(profile.username, profile.url, host);
  } catch {
    return undefined;
  }
}

export function contributorLines(
  commits: ParsedCommit[],
  options: Options
): string[] {
  const contributors = new Map<string, string>();
  for (const commit of commits) {
    const name = authorName(commit.name);
    const profile = profileForCommit(commit, options);
    const key = profile?.url ?? name;
    const label = profile
      ? `${plainText(name)} ([@${plainText(profile.username)}](${profile.url}))`
      : plainText(name);
    if (!contributors.has(key)) contributors.set(key, `- ${label}`);
  }
  return [...contributors.values()].sort();
}
