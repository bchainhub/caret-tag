/** Ensures exactly one trailing slash (trim, then append `/` if missing). */
export function normalizePortalUrl(url: string): string {
  const t = url.trim();
  if (!t) return t;
  return t.endsWith("/") ? t : `${t}/`;
}
