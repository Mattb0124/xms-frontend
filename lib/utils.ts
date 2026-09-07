/**
 * Joins class names, dropping falsy entries. Deliberately tiny: XMS does not
 * carry tailwind-merge, so callers pass non-conflicting utilities.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
