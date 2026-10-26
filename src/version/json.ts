import { readFile } from 'node:fs/promises';

export type JsonObject = Record<string, unknown>;

const jsonIndentPattern = /(?:\r?\n)([\t ]+)"/;
const newlinePattern = /\n/g;

export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseObject(text: string, path: string): JsonObject {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(
      `Invalid JSON in ${path}. Fix the file before planning a version bump.`
    );
  }
  if (!isObject(value)) {
    throw new Error(
      `Expected a JSON object in ${path}. Fix the file before planning a version bump.`
    );
  }
  return value;
}

export function formatJson(value: JsonObject, original: string): string {
  const newline = original.includes('\r\n') ? '\r\n' : '\n';
  const indent = original.match(jsonIndentPattern)?.[1];
  const content = JSON.stringify(value, null, indent).replace(
    newlinePattern,
    newline
  );
  return content + (original.endsWith('\n') ? newline : '');
}

export async function readOptionalFile(
  path: string
): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}
