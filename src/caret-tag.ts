import { DEFAULT_PORTALS } from "./defaults.js";
import { validateRemoteImageResource } from "./remote-image.js";
import type { CaretTagFormat, CaretTagSettings, PortalMap } from "./types.js";
import { filesBaseUrl, normalizePortalUrl, portalMatchesInstanceFiles } from "./url.js";
import { isValidImageId } from "./validate.js";

/** Matches `^portal:id` — portal is a word, id is non-whitespace without `^`. */
const CARET_TAG = /\^([a-zA-Z][a-zA-Z0-9_-]*):([^\s^]+)/g;

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

function buildImageUrl(portalUrl: string, id: string): string {
  return `${normalizePortalUrl(portalUrl)}${id}`;
}

const DEFAULT_HTML_MAX_WIDTH = "260px";
const DEFAULT_HTML_MAX_HEIGHT = "146px";
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

export class CaretTag {
  private readonly settings: CaretTagSettings;
  private readonly format: CaretTagFormat;
  private readonly portals: PortalMap;
  private readonly normalizedAccepted: string[];
  private readonly allowExtensionless: boolean;
  private readonly portalKeys: Set<string>;
  private readonly htmlMaxWidth: string;
  private readonly htmlMaxHeight: string;
  private readonly imageBlock: boolean;
  private readonly validateImageResource: boolean;
  private readonly fetchTimeoutMs: number;

  constructor(settings: CaretTagSettings = {}) {
    const format: CaretTagFormat = settings.format ?? "html";
    if (format === "mfm" && !settings.mfm?.instanceBaseUrl) {
      throw new Error('caret-tag: format "mfm" requires settings.mfm.instanceBaseUrl');
    }

    this.settings = settings;
    this.format = format;
    this.portals = resolvePortals(settings.portals);
    const accepted = settings.acceptedExtensions ?? ["gif"];
    this.normalizedAccepted = accepted.map((e) => e.toLowerCase().replace(/^\./, ""));
    this.allowExtensionless = settings.allowExtensionlessIds ?? false;
    this.portalKeys = new Set(Object.keys(this.portals));
    const size = settings.htmlImageSize;
    this.htmlMaxWidth = size?.maxWidth ?? DEFAULT_HTML_MAX_WIDTH;
    this.htmlMaxHeight = size?.maxHeight ?? DEFAULT_HTML_MAX_HEIGHT;
    this.imageBlock = settings.imageBlock ?? false;
    this.validateImageResource = settings.validateImageResource ?? true;
    this.fetchTimeoutMs = settings.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  }

  /**
   * Replace `^portal:id` markers. When `validateImageResource` is true (default), fetches each
   * target URL to verify an image is returned (see `validateRemoteImageResource`).
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

  private async replaceAsyncWithValidation(input: string): Promise<string> {
    const matches = [...input.matchAll(caretTagRegex())];
    if (matches.length === 0) return input;

    let out = "";
    let lastIndex = 0;
    for (const m of matches) {
      const full = m[0];
      const portalName = m[1]!;
      const id = m[2]!;
      const start = m.index!;
      out += input.slice(lastIndex, start);
      lastIndex = start + full.length;

      const next = await this.replaceOneAsync(portalName, id, full);
      out += next;
    }
    out += input.slice(lastIndex);
    return out;
  }

  private async replaceOneAsync(
    portalName: string,
    id: string,
    full: string,
  ): Promise<string> {
    if (!this.portalKeys.has(portalName)) return full;

    if (!isValidImageId(id, this.normalizedAccepted, this.allowExtensionless)) {
      return full;
    }

    const entry = this.portals[portalName];
    if (!entry?.url) return full;

    const portalUrlNormalized = normalizePortalUrl(entry.url);
    const imageUrl = buildImageUrl(entry.url, id);

    const urlToCheck = this.getRemoteUrlForValidation(
      id,
      imageUrl,
      portalUrlNormalized,
    );
    if (urlToCheck !== null) {
      const ok = await validateRemoteImageResource(urlToCheck, {
        timeoutMs: this.fetchTimeoutMs,
      });
      if (!ok) return "";
    }

    const inner = this.render(this.format, id, imageUrl, portalUrlNormalized);
    return this.wrapReplacement(inner);
  }

  /**
   * URL to validate over HTTP, or `null` when no fetchable URL is emitted (MFM local `$[image id]`).
   */
  private getRemoteUrlForValidation(
    id: string,
    imageUrl: string,
    portalUrlNormalized: string,
  ): string | null {
    if (this.format !== "mfm") {
      return imageUrl;
    }
    const mfm = this.settings.mfm!;
    const filesPath = mfm.filesPath;
    if (
      portalMatchesInstanceFiles(portalUrlNormalized, mfm.instanceBaseUrl, filesPath)
    ) {
      return null;
    }
    const base = filesBaseUrl(mfm.instanceBaseUrl, filesPath);
    return `${base}${encodeURIComponent(id)}`;
  }

  private replaceSync(input: string): string {
    return input.replace(caretTagRegex(), (full, portalName: string, id: string) => {
      if (!this.portalKeys.has(portalName)) return full;

      if (!isValidImageId(id, this.normalizedAccepted, this.allowExtensionless)) {
        return full;
      }

      const entry = this.portals[portalName];
      if (!entry?.url) return full;

      const portalUrlNormalized = normalizePortalUrl(entry.url);
      const imageUrl = buildImageUrl(entry.url, id);

      const inner = this.render(this.format, id, imageUrl, portalUrlNormalized);
      return this.wrapReplacement(inner);
    });
  }

  private wrapReplacement(content: string): string {
    if (!this.imageBlock) return content;
    if (this.format === "html") {
      return `<br />${content}<br />`;
    }
    return `\n\n${content}\n\n`;
  }

  private renderHtmlImg(imageUrl: string, id: string): string {
    const safeSrc = escapeHtmlAttr(imageUrl);
    const safeAlt = escapeHtmlAttr(id);
    const style = escapeHtmlAttr(
      `max-width:${this.htmlMaxWidth};max-height:${this.htmlMaxHeight};width:auto;height:auto;object-fit:contain;`,
    );
    return `<img src="${safeSrc}" alt="${safeAlt}" style="${style}" />`;
  }

  private render(
    format: CaretTagFormat,
    id: string,
    imageUrl: string,
    portalUrlNormalized: string,
  ): string {
    if (format === "raw") return imageUrl;

    if (format === "markdown") {
      return `![${id}](${imageUrl})`;
    }

    if (format === "html") {
      return this.renderHtmlImg(imageUrl, id);
    }

    const mfm = this.settings.mfm!;
    const filesPath = mfm.filesPath;
    if (
      portalMatchesInstanceFiles(portalUrlNormalized, mfm.instanceBaseUrl, filesPath)
    ) {
      return `$[image ${id}]`;
    }

    const base = filesBaseUrl(mfm.instanceBaseUrl, filesPath);
    const remoteUrl = `${base}${encodeURIComponent(id)}`;
    return `![${id}](${remoteUrl})`;
  }
}
