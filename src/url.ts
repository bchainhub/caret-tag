/** Ensures exactly one trailing slash (trim, then append `/` if missing). */
export function normalizePortalUrl(url: string): string {
  const t = url.trim();
  if (!t) return t;
  return t.endsWith("/") ? t : `${t}/`;
}

/** Join instance base and files path into one normalized origin + path prefix. */
export function filesBaseUrl(instanceBaseUrl: string, filesPath = "/files"): string {
  const base = instanceBaseUrl.trim().replace(/\/+$/, "");
  const path = filesPath.startsWith("/") ? filesPath : `/${filesPath}`;
  return normalizePortalUrl(`${base}${path}`);
}

/**
 * True when the portal URL is exactly the instance “files” base (local uploads),
 * so MFM can emit `$[image id]` instead of a remote markdown image.
 */
export function portalMatchesInstanceFiles(
  portalUrlNormalized: string,
  instanceBaseUrl: string,
  filesPath?: string,
): boolean {
  const files = filesBaseUrl(instanceBaseUrl, filesPath);
  return portalUrlNormalized === files;
}
