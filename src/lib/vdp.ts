export type TokenDefinition = {
  key: string;
  label: string;
  required: boolean;
  defaultValue?: string | null;
  validatorRegex?: string | null;
};

const TOKEN_REGEX = /\{\{\s*([^}|]+?)\s*(?:\|\s*default:\"([^\"]*)\")?\s*\}\}/g;

export function resolveTokenString(template: string, values: Record<string, string | undefined>) {
  return template.replace(TOKEN_REGEX, (_, rawKey: string, inlineDefault: string | undefined) => {
    const key = rawKey.trim();
    const value = values[key];
    if (value == null || value === "") {
      return inlineDefault ?? "";
    }

    return value;
  });
}

export function validateTokenValues(definitions: TokenDefinition[], resolved: Record<string, string | undefined>) {
  const errors: string[] = [];

  for (const definition of definitions) {
    const value = resolved[definition.key] ?? definition.defaultValue ?? "";
    if (definition.required && !value) {
      errors.push(`Missing required token: ${definition.key}`);
      continue;
    }

    if (value && definition.validatorRegex) {
      const rx = new RegExp(definition.validatorRegex);
      if (!rx.test(value)) {
        errors.push(`Invalid token format for ${definition.key}`);
      }
    }
  }

  return errors;
}

export function resolveTokensForObject(doc: any, values: Record<string, string | undefined>) {
  if (!doc || typeof doc !== "object") return doc;
  if (Array.isArray(doc)) return doc.map((i) => resolveTokensForObject(i, values));

  return Object.entries(doc).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (typeof value === "string") {
      acc[key] = resolveTokenString(value, values);
    } else {
      acc[key] = resolveTokensForObject(value, values);
    }

    return acc;
  }, {});
}
