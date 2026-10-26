import type { ContributorProfile } from '../types.js';

export type { ContributorProfile } from '../types.js';

type ProfileData = Record<string, unknown>;

function objectValue(value: unknown): ProfileData | undefined {
  return value !== null && typeof value === 'object'
    ? (value as ProfileData)
    : undefined;
}

export function validateProfile(
  username: unknown,
  urlValue: unknown,
  host: string
): ContributorProfile | undefined {
  if (
    typeof username !== 'string' ||
    !username.trim() ||
    username.includes('@') ||
    /[<>\r\n]/.test(username)
  )
    return undefined;
  if (host === 'github.com' && /\s/.test(username)) return undefined;
  if (typeof urlValue !== 'string') return undefined;

  try {
    const url = new URL(urlValue);
    const path = decodeURIComponent(url.pathname);
    if (
      url.protocol !== 'https:' ||
      url.hostname.toLowerCase() !== host ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !path ||
      path === '/' ||
      path.includes('@') ||
      /%40/i.test(url.pathname)
    )
      return undefined;
    return { username: username.trim(), url: url.href };
  } catch {
    return undefined;
  }
}

export function readGitHubProfile(
  data: unknown
): ContributorProfile | undefined {
  const author = objectValue(objectValue(data)?.author);
  return validateProfile(author?.login, author?.html_url, 'github.com');
}

export function readBitbucketProfile(
  data: unknown
): ContributorProfile | undefined {
  const response = objectValue(data);
  const author = objectValue(response?.author);
  const user = objectValue(author?.user);
  if (!user) return undefined;

  const links = objectValue(user.links);
  const html = objectValue(links?.html);
  const username = user.nickname ?? user.display_name;
  return validateProfile(username, html?.href, 'bitbucket.org');
}
