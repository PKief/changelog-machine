const emailAddressPattern =
  /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+(?:@|%40)[A-Z0-9-]+(?:(?:\.|%2e)[A-Z0-9-]+)+/gi;
const unknownContributor = 'Unknown contributor';

export function redactEmails(value: string): string {
  return value.replace(emailAddressPattern, '[redacted email]');
}

export function authorName(value: string): string {
  const name = value.trim();
  return !name || redactEmails(name) !== name ? unknownContributor : name;
}
