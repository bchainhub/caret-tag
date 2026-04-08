import { DEFAULT_PORTALS } from "./defaults.js";
import {
  buildPortalImageUrl,
  parseCssLengthToPx,
} from "./portal-url.js";
import { validateRemoteImageResource } from "./remote-image.js";
import {
  DEFAULT_ID_EXTENSIONS_WHEN_ENABLED,
  type CaretTagFormat,
  type CaretTagSettings,
  type GiphyMediaVariant,
  type ImgurThumbnailOption,
  type PortalEntry,
  type PortalMap,
} from "./types.js";
import { decodeKebabAlt, escapeMarkdownImageAlt } from "./alt-text.js";
import { isValidImageId } from "./validate.js";

/**
 * Matches `^portal:id` or `^portal:id:alt` (optional third segment).
 * `id` must not contain `:`; the third segment is always passed through `decodeKebabAlt` (not configurable).
 * `alt` may contain colons (`^portal:a:b:c` → id `a`, alt `b:c` decoded as one string with hyphens → spaces only).
 */
const CARET_TAG =
  /\^([a-zA-Z][a-zA-Z0-9_-]*):([^:\s^]+)(?::([^\s^]+))?/g;

function caretTagRegex(): RegExp {
  return new RegExp(CARET_TAG.source, CARET_TAG.flags);
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function resolvePortals(portals?: PortalMap): PortalMap {
  if (portals && Object.keys(portals).length > 0) return portals;
  return { ...DEFAULT_PORTALS };
}

const DEFAULT_HTML_MAX_WIDTH = "260px";
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_GIPHY_VARIANT: GiphyMediaVariant = "giphy.gif";
const DEFAULT_IMGUR_THUMB: ImgurThumbnailOption = "auto";

export class CaretTag {
  private readonly format: CaretTagFormat;
  private readonly portals: PortalMap;
  private readonly normalizedAccepted: string[];
  private readonly allowExtensionless: boolean;
  private readonly portalKeys: Set<string>;
  private readonly htmlMaxWidth: string;
  private readonly htmlMaxHeight: string | undefined;
  private readonly maxWidthPx: number | null;
  private readonly giphyMediaVariant: GiphyMediaVariant;
  private readonly imgurThumbnail: ImgurThumbnailOption;
  private readonly imageBlock: boolean;
  private readonly validateImageResource: boolean;
  private readonly fetchTimeoutMs: number;

  constructor(settings: CaretTagSettings = {}) {
    this.format = settings.format ?? "html";
    this.portals = resolvePortals(settings.portals);
    const accepted =
      settings.acceptedExtensions !== undefined
        ? settings.acceptedExtensions
        : settings.enableExtensions
          ? [...DEFAULT_ID_EXTENSIONS_WHEN_ENABLED]
          : [];
    this.normalizedAccepted = accepted.map((e) => e.toLowerCase().replace(/^\./, ""));
    this.allowExtensionless = settings.allowExtensionlessIds ?? true;
    this.portalKeys = new Set(Object.keys(this.portals));
    const size = settings.htmlImageSize;
    this.htmlMaxWidth = size?.maxWidth ?? DEFAULT_HTML_MAX_WIDTH;
    this.htmlMaxHeight = size?.maxHeight;
    this.maxWidthPx = parseCssLengthToPx(this.htmlMaxWidth);
    this.giphyMediaVariant = settings.giphyMediaVariant ?? DEFAULT_GIPHY_VARIANT;
    this.imgurThumbnail = settings.imgurThumbnail ?? DEFAULT_IMGUR_THUMB;
    this.imageBlock = settings.imageBlock ?? false;
    this.validateImageResource = settings.validateImageResource ?? true;
    this.fetchTimeoutMs = settings.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  }

  /**
   * Replace `^portal:id` or `^portal:id:kebab-alt` markers. When `validateImageResource` is true
   * (default), fetches each target URL to verify an image is returned (see `validateRemoteImageResource`).
   */
  async transform(input: string): Promise<string> {
    if (!this.validateImageResource) {
      return this.replaceSync(input);
    }
    return this.replaceAsyncWithValidation(input);
  }

  /**
   * Synchronous replacement without network checks. Only available when
   * `validateImageResource: false`.
   */
  transformSync(input: string): string {
    if (this.validateImageResource) {
      throw new Error(
        "caret-tag: validateImageResource is true (default); use await transform() or set validateImageResource: false for transformSync()",
      );
    }
    return this.replaceSync(input);
  }

  private imageUrlFor(entry: PortalEntry, id: string): string {
    return buildPortalImageUrl(entry, id, {
      maxWidthPx: this.maxWidthPx,
      giphyMediaVariant: this.giphyMediaVariant,
      imgurThumbnail: this.imgurThumbnail,
    });
  }

  private async replaceAsyncWithValidation(input: string): Promise<string> {
    const matches = [...input.matchAll(caretTagRegex())];
    if (matches.length === 0) return input;

    let out = "";
    let lastIndex = 0;
    for (const m of matches) {
      const full = m[0];
      const portalName = m[1]!;
      const id = m[2]!;
      const altRaw = m[3];
      const start = m.index!;
      out += input.slice(lastIndex, start);
      lastIndex = start + full.length;

      const next = await this.replaceOneAsync(portalName, id, altRaw, full);
      out += next;
    }
    out += input.slice(lastIndex);
    return out;
  }

  private async replaceOneAsync(
    portalName: string,
    id: string,
    altRaw: string | undefined,
    full: string,
  ): Promise<string> {
    if (!this.portalKeys.has(portalName)) return full;

    if (!isValidImageId(id, this.normalizedAccepted, this.allowExtensionless)) {
      return full;
    }

    const entry = this.portals[portalName];
    if (!entry?.url) return full;

    const imageUrl = this.imageUrlFor(entry, id);

    const ok = await validateRemoteImageResource(imageUrl, {
      timeoutMs: this.fetchTimeoutMs,
    });
    if (!ok) return "";

    const inner = this.render(this.format, imageUrl, id, altRaw);
    return this.wrapReplacement(inner);
  }

  private replaceSync(input: string): string {
    return input.replace(
      caretTagRegex(),
      (full, portalName: string, id: string, altRaw?: string) => {
        if (!this.portalKeys.has(portalName)) return full;

        if (!isValidImageId(id, this.normalizedAccepted, this.allowExtensionless)) {
          return full;
        }

        const entry = this.portals[portalName];
        if (!entry?.url) return full;

        const imageUrl = this.imageUrlFor(entry, id);

        const inner = this.render(this.format, imageUrl, id, altRaw);
        return this.wrapReplacement(inner);
      },
    );
  }

  private wrapReplacement(content: string): string {
    if (!this.imageBlock) return content;
    if (this.format === "html") {
      return `<br />${content}<br />`;
    }
    return `\n\n${content}\n\n`;
  }

  private renderHtmlImg(imageUrl: string, htmlAlt?: string): string {
    const safeSrc = escapeHtmlAttr(imageUrl);
    const parts: string[] = [
      `max-width:${this.htmlMaxWidth}`,
      `width:auto`,
      `height:auto`,
      `object-fit:contain`,
    ];
    if (this.htmlMaxHeight !== undefined) {
      parts.splice(1, 0, `max-height:${this.htmlMaxHeight}`);
    }
    const style = escapeHtmlAttr(`${parts.join(";")};`);
    const altAttr =
      htmlAlt !== undefined ? ` alt="${escapeHtmlAttr(htmlAlt)}"` : "";
    return `<img src="${safeSrc}"${altAttr} style="${style}" />`;
  }

  private render(
    format: CaretTagFormat,
    imageUrl: string,
    id: string,
    altRaw?: string,
  ): string {
    if (format === "raw") return imageUrl;

    // Third segment: always kebab-decode for HTML and Markdown (no CaretTag setting).
    const htmlAlt =
      altRaw !== undefined ? decodeKebabAlt(altRaw) : undefined;
    const markdownAlt =
      altRaw !== undefined ? decodeKebabAlt(altRaw) : id;

    if (format === "markdown") {
      return `![${escapeMarkdownImageAlt(markdownAlt)}](${imageUrl})`;
    }

    return this.renderHtmlImg(imageUrl, htmlAlt);
  }
}
