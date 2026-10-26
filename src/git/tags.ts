const numericIdentifier = /^(0|[1-9]\d*)$/;
const allowedIdentifierCharacters = /^[A-Za-z0-9-]+$/;
const onlyDigits = /^\d+$/;

function validPrerelease(value: string): boolean {
  return value
    .split('.')
    .every(
      (identifier) =>
        allowedIdentifierCharacters.test(identifier) &&
        (!onlyDigits.test(identifier) || numericIdentifier.test(identifier))
    );
}

function validBuild(value: string): boolean {
  return value
    .split('.')
    .every((identifier) => allowedIdentifierCharacters.test(identifier));
}

export function isVersionTag(tag: string): boolean {
  const version = tag.startsWith('v') ? tag.slice(1) : tag;
  const [release, build, extraBuild] = version.split('+');
  if (extraBuild !== undefined || (build !== undefined && !validBuild(build)))
    return false;

  const prereleaseStart = release.indexOf('-');
  const core =
    prereleaseStart < 0 ? release : release.slice(0, prereleaseStart);
  const parts = core.split('.');
  if (
    parts.length !== 3 ||
    !parts.every((part) => numericIdentifier.test(part))
  )
    return false;

  return (
    prereleaseStart < 0 || validPrerelease(release.slice(prereleaseStart + 1))
  );
}
