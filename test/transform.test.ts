import { describe, expect, it, vi } from "vitest";
import { CaretTag } from "../src/caret-tag.js";
import { normalizePortalUrl, portalMatchesInstanceFiles } from "../src/url.js";
import { isValidImageId } from "../src/validate.js";

const DEFAULT_IMG_STYLE =
  'style="max-width:260px;max-height:146px;width:auto;height:auto;object-fit:contain;"';

/** Fast tests without network (default `validateImageResource` is true). */
function tag(
  settings: ConstructorParameters<typeof CaretTag>[0] = {},
): CaretTag {
  return new CaretTag({ validateImageResource: false, ...settings });
}

describe("CaretTag", () => {
  it("defaults to HTML for built-in giphy", () => {
    const out = tag().transformSync("x ^giphy:cat.gif y");
    expect(out).toBe(
      `x <img src="https://giphy.com/gifs/cat.gif" alt="cat.gif" ${DEFAULT_IMG_STYLE} /> y`,
    );
  });

  it("outputs markdown", () => {
    const out = tag({ format: "markdown" }).transformSync("x ^giphy:cat.gif y");
    expect(out).toBe("x ![cat.gif](https://giphy.com/gifs/cat.gif) y");
  });

  it("outputs raw URL", () => {
    const out = tag({ format: "raw" }).transformSync("x ^giphy:cat.gif y");
    expect(out).toBe("x https://giphy.com/gifs/cat.gif y");
  });

  it("uses custom portals only when list is non-empty", () => {
    const out = tag({
      portals: { custom: { url: "https://example.com/p/" } },
    }).transformSync("^giphy:nope.gif");
    expect(out).toBe("^giphy:nope.gif");

    const ok = tag({
      portals: { custom: { url: "https://example.com/p/" } },
    }).transformSync("^custom:ok.gif");
    expect(ok).toBe(
      `<img src="https://example.com/p/ok.gif" alt="ok.gif" ${DEFAULT_IMG_STYLE} />`,
    );
  });

  it("MFM uses $[image id] when portal URL equals instance files base", () => {
    const out = tag({
      format: "mfm",
      portals: {
        files: { url: "https://coretalk.space/files" },
      },
      mfm: { instanceBaseUrl: "https://coretalk.space", filesPath: "/files" },
    }).transformSync("^files:abc.gif");
    expect(out).toBe("$[image abc.gif]");
  });

  it("MFM falls back to markdown with instance files URL when portal is remote", () => {
    const out = tag({
      format: "mfm",
      mfm: { instanceBaseUrl: "https://coretalk.space", filesPath: "/files" },
    }).transformSync("^giphy:abc.gif");
    expect(out).toBe(
      "![abc.gif](https://coretalk.space/files/abc.gif)",
    );
  });

  it("does not transform unknown portals", () => {
    expect(tag().transformSync("^unknown:a.gif")).toBe("^unknown:a.gif");
  });

  it("does not transform invalid ids (wrong extension)", () => {
    expect(tag().transformSync("^giphy:evil.exe")).toBe("^giphy:evil.exe");
  });

  it("allows png when acceptedExtensions includes png", () => {
    const out = tag({
      acceptedExtensions: ["gif", "png"],
    }).transformSync("^giphy:pic.png");
    expect(out).toContain("pic.png");
  });

  it("allows extensionless ids when enabled", () => {
    const out = tag({
      allowExtensionlessIds: true,
    }).transformSync("^giphy:abc123");
    expect(out).toContain("https://giphy.com/gifs/abc123");
  });

  it("throws when mfm is missing instanceBaseUrl", () => {
    expect(() => new CaretTag({ format: "mfm" })).toThrow(/instanceBaseUrl/);
  });

  it("applies custom htmlImageSize in style", () => {
    const out = tag({
      htmlImageSize: { maxWidth: "400px", maxHeight: "200px" },
    }).transformSync("^giphy:a.gif");
    expect(out).toContain("max-width:400px");
    expect(out).toContain("max-height:200px");
  });

  it("imageBlock wraps HTML with br", () => {
    const out = tag({ imageBlock: true }).transformSync("a ^giphy:x.gif b");
    expect(out).toBe(
      `a <br /><img src="https://giphy.com/gifs/x.gif" alt="x.gif" ${DEFAULT_IMG_STYLE} /><br /> b`,
    );
  });

  it("imageBlock wraps markdown with newlines", () => {
    const out = tag({ format: "markdown", imageBlock: true }).transformSync(
      "a ^giphy:x.gif b",
    );
    expect(out).toBe("a \n\n![x.gif](https://giphy.com/gifs/x.gif)\n\n b");
  });

  it("imageBlock wraps raw with newlines", () => {
    const out = tag({ format: "raw", imageBlock: true }).transformSync(
      "a ^giphy:x.gif b",
    );
    expect(out).toBe("a \n\nhttps://giphy.com/gifs/x.gif\n\n b");
  });

  it("imageBlock wraps mfm with newlines", () => {
    const out = tag({
      format: "mfm",
      imageBlock: true,
      mfm: { instanceBaseUrl: "https://coretalk.space", filesPath: "/files" },
    }).transformSync("a ^giphy:x.gif b");
    expect(out).toBe(
      "a \n\n![x.gif](https://coretalk.space/files/x.gif)\n\n b",
    );
  });

  it("transformSync throws when validateImageResource is true (default)", () => {
    expect(() => new CaretTag().transformSync("^giphy:a.gif")).toThrow(
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
    }).transform("before ^t:x.gif after");

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
    }).transform("^t:x.gif");

    expect(out).toContain("<img ");
    expect(out).toContain("https://example.com/i/x.gif");
    vi.unstubAllGlobals();
  });

  it("MFM local skips fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const out = await new CaretTag({
      validateImageResource: true,
      format: "mfm",
      portals: {
        files: { url: "https://coretalk.space/files" },
      },
      mfm: { instanceBaseUrl: "https://coretalk.space", filesPath: "/files" },
    }).transform("^files:abc.gif");

    expect(out).toBe("$[image abc.gif]");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("normalizePortalUrl", () => {
  it("adds trailing slash", () => {
    expect(normalizePortalUrl("https://a.com/x")).toBe("https://a.com/x/");
  });
});

describe("portalMatchesInstanceFiles", () => {
  it("matches normalized files base", () => {
    expect(
      portalMatchesInstanceFiles(
        "https://coretalk.space/files/",
        "https://coretalk.space",
        "/files",
      ),
    ).toBe(true);
  });
});

describe("isValidImageId", () => {
  it("rejects path segments and schemes", () => {
    expect(isValidImageId("../x.gif", ["gif"], false)).toBe(false);
    expect(isValidImageId("x/y.gif", ["gif"], false)).toBe(false);
    expect(isValidImageId("data:x", ["gif"], true)).toBe(false);
  });
});
