/** Output format for replacements. */
export type CaretTagFormat = "html" | "markdown" | "raw" | "mfm";

/** One portal entry: key is the name used after `^` (e.g. `giphy` in `^giphy:id`). */
export type PortalEntry = {
  /** Base URL for this portal; a trailing slash is added if missing. */
  url: string;
};

export type PortalMap = Record<string, PortalEntry>;

/** Misskey-style local file handling when format is `mfm`. */
/** Max dimensions for HTML `<img>` output; aspect ratio is preserved via CSS. */
export type HtmlImageSizeOptions = {
  /** CSS `max-width` (e.g. `260px`, `100%`). Default `260px`. */
  maxWidth?: string;
  /** CSS `max-height` (e.g. `146px`). Default `146px`. */
  maxHeight?: string;
};

export type MfmOptions = {
  /**
   * Instance origin, e.g. `https://coretalk.space` (no trailing slash required).
   * Used with `filesPath` to detect when a portal URL points at this instance’s files.
   */
  instanceBaseUrl: string;
  /**
   * Path segment for files on the instance, default `/files`.
   * Full files base = `instanceBaseUrl` + `filesPath`.
   */
  filesPath?: string;
};

export type CaretTagSettings = {
  /**
   * Named portals: `^name:id` uses `name` as the key.
   * If omitted or empty, built-in defaults are used (Tenor, Imgur, Giphy, GIFbin).
   */
  portals?: PortalMap;
  /**
   * Output format. Default `html`.
   * - `html` — `<img src="…" alt="…" style="max-width…;max-height…;…" />` (see `htmlImageSize`)
   * - `markdown` — `![id](url)`
   * - `raw` — `https://…`
   * - `mfm` — `$[image id]` when portal matches instance files, else `![id](filesUrl)`
   */
  format?: CaretTagFormat;
  /**
   * Allowed file extensions for the `id` segment (lowercase, without dot).
   * Default `["gif"]`. If the id has no extension, see `allowExtensionlessIds`.
   */
  acceptedExtensions?: string[];
  /**
   * When the id has no `.ext`, allow it only if true (still subject to safe-id rules).
   * Default `false` for strict image checks.
   */
  allowExtensionlessIds?: boolean;
  /** Required when `format` is `mfm`. */
  mfm?: MfmOptions;
  /**
   * Optional CSS limits for HTML `<img>` output (`max-width` / `max-height`, `object-fit: contain`).
   * Defaults: max-width `260px`, max-height `146px`. Ignored when `format` is not `html`.
   */
  htmlImageSize?: HtmlImageSizeOptions;
  /**
   * When true, place each replacement on its own line: HTML uses `<br />` before and after;
   * markdown, raw, and MFM use `\n\n` before and after.
   */
  imageBlock?: boolean;
};
