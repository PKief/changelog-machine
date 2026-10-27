const sourceRoot = new URL('../src/', import.meta.url).href;

export function resolve(specifier, context, nextResolve) {
  const isSourceImport =
    context.parentURL?.startsWith(sourceRoot) ||
    specifier.startsWith(sourceRoot);
  if (specifier.endsWith('.js') && isSourceImport) {
    const sourceSpecifier = `${specifier.slice(0, -3)}.ts`;
    try {
      return nextResolve(sourceSpecifier, context);
    } catch (error) {
      if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    }
  }
  return nextResolve(specifier, context);
}
