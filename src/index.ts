export { decodeKebabAlt, escapeMarkdownImageAlt } from "./alt-text.js";
export { CaretTag } from "./caret-tag.js";
export { DEFAULT_PORTALS } from "./defaults.js";
export {
  buildPortalImageUrl,
  imgurFilenameWithSuffix,
  imgurSuffixForMaxWidthPx,
  parseCssLengthToPx,
  parseImgurStemAndExt,
  resolveImgurThumbnail,
  TENOR_WIDTH_THRESHOLD_PX,
  tenorFilenameForMaxWidthPx,
} from "./portal-url.js";
export {
  DEFAULT_ID_EXTENSIONS_WHEN_ENABLED,
} from "./types.js";
export type {
  CaretTagFormat,
  CaretTagSettings,
  GiphyMediaVariant,
  HtmlImageSizeOptions,
  ImgurSizeSuffix,
  ImgurThumbnailOption,
  PortalEntry,
  PortalMap,
  PortalProvider,
} from "./types.js";
export { normalizePortalUrl } from "./url.js";
export { isValidImageId } from "./validate.js";
export {
  hasImageMagicBytes,
  isSsrfSafeUrl,
  validateRemoteImageResource,
} from "./remote-image.js";
