import { describe, expect, it, vi } from "vitest";
import { CaretTag } from "../src/caret-tag.js";
import { normalizePortalUrl } from "../src/url.js";
import { isValidImageId } from "../src/validate.js";

const GIPHY_CAT = "https://media1.giphy.com/media/cat/giphy.gif";

const DEFAULT_IMG_STYLE =
  'style="max-width:260px;width:auto;height:auto;object-fit:contain;"';

const imgHtml = (src: string, alt?: string) =>
  alt !== undefined
    ? `<img src="${src}" alt="${alt}" ${DEFAULT_IMG_STYLE} />`
    : `<img src="${src}" ${DEFAULT_IMG_STYLE} />`;

/** Fast tests without network (default `validateImageResource` is true). */
function tag(
  settings: ConstructorParameters<typeof CaretTag>[0] = {},
): CaretTag {
  return new CaretTag({ validateImageResource: false, ...settings });
}

describe("CaretTag", () => {
  it("defaults to HTML for built-in giphy (no alt attr without third segment)", () => {
    const out = tag().transformSync("x ^giphy:cat y");
    expect(out).toBe(`x ${imgHtml(GIPHY_CAT)} y`);
  });

  it("outputs markdown with id as alt when alt segment omitted", () => {
    const out = tag({ format: "markdown" }).transformSync("x ^giphy:cat y");
    expect(out).toBe(`x ![cat](${GIPHY_CAT}) y`);
  });

  it("outputs raw URL", () => {
    const out = tag({ format: "raw" }).transformSync("x ^giphy:cat y");
    expect(out).toBe(`x ${GIPHY_CAT} y`);
  });

  it("uses custom portals only when list is non-empty", () => {
    const out = tag({
      portals: { custom: { url: "https://example.com/p/" } },
    }).transformSync("^giphy:nope.gif");
    expect(out).toBe("^giphy:nope.gif");

    const ok = tag({
      portals: { custom: { url: "https://example.com/p/" } },
    }).transformSync("^custom:ok");
    expect(ok).toBe(`<img src="https://example.com/p/ok" ${DEFAULT_IMG_STYLE} />`);
  });

  it("does not transform unknown portals", () => {
    expect(tag().transformSync("^unknown:a")).toBe("^unknown:a");
  });

  it("does not transform invalid ids (wrong extension)", () => {
    expect(tag().transformSync("^giphy:evil.exe")).toBe("^giphy:evil.exe");
  });

  it("allows png when acceptedExtensions includes png", () => {
    const out = tag({
      acceptedExtensions: ["gif", "png"],
    }).transformSync("^giphy:pic.png");
    expect(out).toContain("https://media1.giphy.com/media/pic/giphy.gif");
  });

  it("allows dotted ids when enableExtensions is true", () => {
    const out = tag({ enableExtensions: true }).transformSync(
      "x ^giphy:cat.gif y",
    );
    expect(out).toContain("https://media1.giphy.com/media/cat/giphy.gif");
    expect(out).not.toContain("alt=");
  });

  it("allows extensionless ids by default", () => {
    const out = tag().transformSync("^giphy:abc123");
    expect(out).toContain(
      "https://media1.giphy.com/media/abc123/giphy.gif",
    );
  });

  it("rejects extensionless ids when allowExtensionlessIds is false", () => {
    expect(
      tag({ allowExtensionlessIds: false }).transformSync("^giphy:abc123"),
    ).toBe("^giphy:abc123");
  });

  it("applies custom htmlImageSize in style", () => {
    const out = tag({
      htmlImageSize: { maxWidth: "400px", maxHeight: "200px" },
    }).transformSync("^giphy:a");
    expect(out).toContain("max-width:400px");
    expect(out).toContain("max-height:200px");
  });

  it("imageBlock wraps HTML with br", () => {
    const out = tag({ imageBlock: true }).transformSync("a ^giphy:x b");
    expect(out).toBe(
      `a <br />${imgHtml("https://media1.giphy.com/media/x/giphy.gif")}<br /> b`,
    );
  });

  it("imageBlock wraps markdown with newlines", () => {
    const out = tag({ format: "markdown", imageBlock: true }).transformSync(
      "a ^giphy:x b",
    );
    expect(out).toBe(
      "a \n\n![x](https://media1.giphy.com/media/x/giphy.gif)\n\n b",
    );
  });

  it("imageBlock wraps raw with newlines", () => {
    const out = tag({ format: "raw", imageBlock: true }).transformSync(
      "a ^giphy:x b",
    );
    expect(out).toBe(
      "a \n\nhttps://media1.giphy.com/media/x/giphy.gif\n\n b",
    );
  });

  it("transformSync throws when validateImageResource is true (default)", () => {
    expect(() => new CaretTag().transformSync("^giphy:a")).toThrow(
      /validateImageResource/,
    );
  });

  it("await transform removes marker when remote validation fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      body: null,
      arrayBuffer: async () => new Uint8Array([0x3c, 0x68, 0x74]).buffer,
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await new CaretTag({
      validateImageResource: true,
      portals: { t: { url: "https://example.com/i/" } },
    }).transform("before ^t:x after");

    expect(out).toBe("before  after");
    vi.unstubAllGlobals();
  });

  it("await transform replaces when HEAD returns image content-type", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "image/gif" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await new CaretTag({
      validateImageResource: true,
      portals: { t: { url: "https://example.com/i/" } },
    }).transform("^t:x");

    expect(out).toContain("<img ");
    expect(out).not.toContain("alt=");
    expect(out).toContain("https://example.com/i/x");
    vi.unstubAllGlobals();
  });

  it("uses tenor_s.gif when default max-width is 260px", () => {
    const out = tag().transformSync("^tenor:nDrR1iOWmn0AAAAd");
    expect(out).toContain(
      "https://media.tenor.com/nDrR1iOWmn0AAAAd/tenor_s.gif",
    );
  });

  it("uses tenor.gif when max-width px is closer to 480 than 300", () => {
    const out = tag({
      htmlImageSize: { maxWidth: "400px" },
    }).transformSync("^tenor:nDrR1iOWmn0AAAAd");
    expect(out).toContain(
      "https://media.tenor.com/nDrR1iOWmn0AAAAd/tenor.gif",
    );
  });

  it("respects giphyMediaVariant", () => {
    const out = tag({ giphyMediaVariant: "200.gif" }).transformSync(
      "^giphy:cat",
    );
    expect(out).toContain(
      "https://media1.giphy.com/media/cat/200.gif",
    );
  });

  it("inserts imgur thumbnail letter from default max-width", () => {
    const out = tag().transformSync("^imgur:abcd123");
    expect(out).toContain("https://i.imgur.com/abcd123m");
  });

  it("uses imgur original when imgurThumbnail is original", () => {
    const out = tag({ imgurThumbnail: "original" }).transformSync(
      "^imgur:abcd123",
    );
    expect(out).toContain("https://i.imgur.com/abcd123");
    expect(out).not.toContain("abcd123m");
  });

  it("adds html alt and markdown decoded alt when third segment present", () => {
    const url = "https://i.imgur.com/tpTZxoXm";
    const html = tag().transformSync(`^imgur:tpTZxoX:my-cool-label`);
    expect(html).toContain(imgHtml(url, "my cool label"));

    const md = tag({ format: "markdown" }).transformSync(
      "^imgur:tpTZxoX:my-cool-label",
    );
    expect(md).toBe(`![my cool label](${url})`);
  });
});

describe("normalizePortalUrl", () => {
  it("adds trailing slash", () => {
    expect(normalizePortalUrl("https://a.com/x")).toBe("https://a.com/x/");
  });
});

describe("isValidImageId", () => {
  it("rejects path segments and schemes", () => {
    expect(isValidImageId("../x.gif", ["gif"], false)).toBe(false);
    expect(isValidImageId("x/y.gif", ["gif"], false)).toBe(false);
    expect(isValidImageId("data:x", ["gif"], true)).toBe(false);
  });

  it("rejects dotted ids when acceptedExtensions is empty", () => {
    expect(isValidImageId("a.gif", [], true)).toBe(false);
    expect(isValidImageId("a", [], true)).toBe(true);
  });
});
