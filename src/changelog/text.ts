const markdownPunctuationPattern = /[\\`*_{}\[\]()#!|]/g;
const textLineBreakPattern = /[\r\n]+/g;
const segmentUnsafeCharactersPattern = /[!'()*]/g;

export function capitalizeMessage(value: string): string {
  return value.replace(/\p{L}/u, (letter) => letter.toUpperCase());
}

export function safeText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function plainText(value: string): string {
  return safeText(value)
    .replace(markdownPunctuationPattern, '\\$&')
    .replace(textLineBreakPattern, ' ');
}

export function encodeCharacter(character: string): string {
  return `%${character.charCodeAt(0).toString(16).toUpperCase()}`;
}

export function encodeSegment(value: string): string {
  return encodeURIComponent(value).replace(
    segmentUnsafeCharactersPattern,
    encodeCharacter
  );
}
