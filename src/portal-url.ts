import type {
  GiphyMediaVariant,
  ImgurSizeSuffix,
  ImgurThumbnailOption,
  PortalEntry,
} from "./types.js";
import { normalizePortalUrl } from "./url.js";

/** Midpoint between “preview” (~300px) and “large” (~480px) Tenor assets. */
export const TENOR_WIDTH_THRESHOLD_PX = (300 + 480) / 2;

const IMGUR_SUFFIX_SET = new Set<string>(["s", "b", "t", "m", "l", "h"]);

/** Minimum stem length after stripping a thumbnail letter (avoids corrupting short ids). */
const IMGUR_MIN_STEM_LEN = 4;

/**
 * Parse a pixel length like `260px`. Returns null for `%`, `em`, etc.
 */
export function parseCssLengthToPx(value: string): number | null {
  const m = /^(\d+(?:\.\d+)?)px\s*$/i.exec(value.trim());
  if (!m) return null;
  return Number(m[1]);
}

/**
 * `tenor.gif` (larger) vs `tenor_s.gif` (preview): if max width in px is at or above the
 * threshold (closer to 480 than 300), use `tenor.gif`.
 */
export function tenorFilenameForMaxWidthPx(
  px: number | null,
): "tenor.gif" | "tenor_s.gif" {
  if (px === null) return "tenor_s.gif";
  return px >= TENOR_WIDTH_THRESHOLD_PX ? "tenor.gif" : "tenor_s.gif";
}

/**
 * Pick an Imgur thumbnail letter from layout max-width in px.
 * Returns **`null`** for the original (no letter before the extension) when **`px` &gt; 1024**.
 * When **`px`** is **`null`** (non-pixel width), returns **`m`** as a reasonable default.
 */
export function imgurSuffixForMaxWidthPx(
  px: number | null,
): ImgurSizeSuffix | null {
  if (px === null) return "m";
  if (px <= 0) return "m";
  if (px > 1024) return null;
  if (px <= 90) return "s";
  if (px <= 160) return "t";
  if (px <= 320) return "m";
  if (px <= 640) return "l";
  return "h";
}

export function resolveImgurThumbnail(
  option: ImgurThumbnailOption,
  maxWidthPx: number | null,
): ImgurSizeSuffix | null {
  if (option === "original") return null;
  if (option === "auto") return imgurSuffixForMaxWidthPx(maxWidthPx);
  return option;
}

/**
 * Split id into stem + extension. With no **`.{ext}`** in the id, **`ext`** is **`""`** (extensionless).
 * Strips a trailing Imgur size letter from the stem when the id had an explicit extension
 * (e.g. `abcd123m.jpg` → stem `abcd123`, `.jpg`).
 */
export function parseImgurStemAndExt(id: string): { stem: string; ext: string } {
  const lower = id.toLowerCase();
  let ext = "";
  let stem = id;
  let hadExplicitExtension = false;
  for (const e of [".gif", ".png", ".jpg", ".jpeg", ".webp"]) {
    if (lower.endsWith(e)) {
      ext = id.slice(id.length - e.length);
      stem = id.slice(0, -e.length);
      hadExplicitExtension = true;
      break;
    }
  }

  // Only strip a trailing Imgur size letter when the id already had `.{ext}` (…hashm.jpg).
  // Extensionless ids (e.g. `noext`) stay the full hash even if they end in `s`…`h`.
  if (hadExplicitExtension && stem.length >= 2) {
    const last = stem[stem.length - 1]!.toLowerCase();
    if (
      IMGUR_SUFFIX_SET.has(last) &&
      stem.length - 1 >= IMGUR_MIN_STEM_LEN
    ) {
      stem = stem.slice(0, -1);
    }
  }

  return { stem, ext };
}

/** `https://i.imgur.com/` + stem, optional size letter, optional **`.ext`** from the id. */
export function imgurFilenameWithSuffix(
  id: string,
  suffix: ImgurSizeSuffix | null,
): string {
  const { stem, ext } = parseImgurStemAndExt(id);
  if (suffix === null) return `${stem}${ext}`;
  return `${stem}${suffix}${ext}`;
}

function stripTrailingMediaExtension(id: string): string {
  const lower = id.toLowerCase();
  for (const ext of [".gif", ".png", ".jpg", ".jpeg", ".webp"]) {
    if (lower.endsWith(ext)) return id.slice(0, -ext.length);
  }
  return id;
}

export function buildPortalImageUrl(
  entry: PortalEntry,
  id: string,
  options: {
    maxWidthPx: number | null;
    giphyMediaVariant: GiphyMediaVariant;
    imgurThumbnail: ImgurThumbnailOption;
  },
): string {
  const provider = entry.provider ?? "simple";

  if (provider === "simple") {
    return `${normalizePortalUrl(entry.url)}${id}`;
  }

  if (provider === "tenor") {
    const file = tenorFilenameForMaxWidthPx(options.maxWidthPx);
    return `https://media.tenor.com/${id}/${file}`;
  }

  if (provider === "imgur") {
    const suffix = resolveImgurThumbnail(
      options.imgurThumbnail,
      options.maxWidthPx,
    );
    return `https://i.imgur.com/${imgurFilenameWithSuffix(id, suffix)}`;
  }

  if (provider === "giphy") {
    const mid = stripTrailingMediaExtension(id);
    return `https://media1.giphy.com/media/${mid}/${options.giphyMediaVariant}`;
  }

  return `${normalizePortalUrl(entry.url)}${id}`;
}
