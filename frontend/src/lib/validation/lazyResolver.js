/**
 * Resolver de react-hook-form que descarga zod (~39 KB gzip) la primera vez que valida, no con la
 * página (auditoría H4). Valida igual que `zodResolver(schema)`. Créalo fuera del componente, una
 * sola vez por formulario.
 * @param {() => Promise<import('zod').ZodType>} loadSchema Importa y devuelve el esquema.
 * @returns {import('react-hook-form').Resolver}
 */
export function lazyResolver(loadSchema) {
  let resolver;
  return async (values, context, options) => {
    resolver ??= Promise.all([import('@hookform/resolvers/zod'), loadSchema()]).then(([m, schema]) => m.zodResolver(schema));
    // Si la descarga falla, el siguiente intento vuelve a pedirla.
    resolver.catch(() => (resolver = undefined));
    return (await resolver)(values, context, options);
  };
}
