/**
 * Turn kebab-case marker text into human-readable alt (hyphens → spaces).
 * Whenever a marker includes a third segment (`^portal:id:alt`), this runs — there is no setting to disable or skip it.
 */
export function decodeKebabAlt(raw: string): string {
  return raw.replace(/-/g, " ").trim();
}

/**
 * Escape `]` and `\` for CommonMark-style `![alt](url)` alt text.
 */
export function escapeMarkdownImageAlt(alt: string): string {
  return alt.replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
}
