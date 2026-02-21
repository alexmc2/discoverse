export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const isRelative =
      specifier.startsWith('./') ||
      specifier.startsWith('../') ||
      specifier.startsWith('/');
    const hasExtension = /\.[a-z0-9]+$/i.test(specifier);

    if (isRelative && !hasExtension) {
      return nextResolve(`${specifier}.ts`, context);
    }

    throw error;
  }
}

