/** Escape single quotes for Bicep string literals. */
export function escapeBicepString(s: string): string {
  return s.replace(/'/g, "''");
}

/** Bicep object literal for tag maps. */
export function renderBicepObjectLiteral(tags: Record<string, string>): string {
  const lines = Object.entries(tags).map(([k, v]) => {
    const key = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : `'${escapeBicepString(k)}'`;
    return `    ${key}: '${escapeBicepString(v)}'`;
  });
  return `{\n${lines.join('\n')}\n  }`;
}
