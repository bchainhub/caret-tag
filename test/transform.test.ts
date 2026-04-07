import { describe, expect, it } from "vitest";
import { CaretTag } from "../src/caret-tag.js";
import { normalizePortalUrl, portalMatchesInstanceFiles } from "../src/url.js";
import { isValidImageId } from "../src/validate.js";

const DEFAULT_IMG_STYLE =
  'style="max-width:260px;max-height:146px;width:auto;height:auto;object-fit:contain;"';

describe("CaretTag", () => {
  it("defaults to HTML for built-in giphy", () => {
    const out = new CaretTag().transform("x ^giphy:cat.gif y");
    expect(out).toBe(
      `x <img src="https://giphy.com/gifs/cat.gif" alt="cat.gif" ${DEFAULT_IMG_STYLE} /> y`,
    );
  });

  it("outputs markdown", () => {
    const out = new CaretTag({ format: "markdown" }).transform(
      "x ^giphy:cat.gif y",
    );
    expect(out).toBe("x ![cat.gif](https://giphy.com/gifs/cat.gif) y");
  });

  it("outputs raw URL", () => {
    const out = new CaretTag({ format: "raw" }).transform(
      "x ^giphy:cat.gif y",
    );
    expect(out).toBe("x https://giphy.com/gifs/cat.gif y");
  });

  it("uses custom portals only when list is non-empty", () => {
    const out = new CaretTag({
      portals: { custom: { url: "https://example.com/p/" } },
    }).transform("^giphy:nope.gif");
    expect(out).toBe("^giphy:nope.gif");

    const ok = new CaretTag({
      portals: { custom: { url: "https://example.com/p/" } },
    }).transform("^custom:ok.gif");
    expect(ok).toBe(
      `<img src="https://example.com/p/ok.gif" alt="ok.gif" ${DEFAULT_IMG_STYLE} />`,
    );
  });

  it("MFM uses $[image id] when portal URL equals instance files base", () => {
    const out = new CaretTag({
      format: "mfm",
      portals: {
        files: { url: "https://coretalk.space/files" },
      },
      mfm: { instanceBaseUrl: "https://coretalk.space", filesPath: "/files" },
    }).transform("^files:abc.gif");
    expect(out).toBe("$[image abc.gif]");
  });

  it("MFM falls back to markdown with instance files URL when portal is remote", () => {
    const out = new CaretTag({
      format: "mfm",
      mfm: { instanceBaseUrl: "https://coretalk.space", filesPath: "/files" },
    }).transform("^giphy:abc.gif");
    expect(out).toBe(
      "![abc.gif](https://coretalk.space/files/abc.gif)",
    );
  });

  it("does not transform unknown portals", () => {
    expect(new CaretTag().transform("^unknown:a.gif")).toBe("^unknown:a.gif");
  });

  it("does not transform invalid ids (wrong extension)", () => {
    expect(new CaretTag().transform("^giphy:evil.exe")).toBe(
      "^giphy:evil.exe",
    );
  });

  it("allows png when acceptedExtensions includes png", () => {
    const out = new CaretTag({
      acceptedExtensions: ["gif", "png"],
    }).transform("^giphy:pic.png");
    expect(out).toContain("pic.png");
  });

  it("allows extensionless ids when enabled", () => {
    const out = new CaretTag({
      allowExtensionlessIds: true,
    }).transform("^giphy:abc123");
    expect(out).toContain("https://giphy.com/gifs/abc123");
  });

  it("throws when mfm is missing instanceBaseUrl", () => {
    expect(() => new CaretTag({ format: "mfm" })).toThrow(/instanceBaseUrl/);
  });

  it("applies custom htmlImageSize in style", () => {
    const out = new CaretTag({
      htmlImageSize: { maxWidth: "400px", maxHeight: "200px" },
    }).transform("^giphy:a.gif");
    expect(out).toContain("max-width:400px");
    expect(out).toContain("max-height:200px");
  });

  it("imageBlock wraps HTML with br", () => {
    const out = new CaretTag({ imageBlock: true }).transform(
      "a ^giphy:x.gif b",
    );
    expect(out).toBe(
      `a <br /><img src="https://giphy.com/gifs/x.gif" alt="x.gif" ${DEFAULT_IMG_STYLE} /><br /> b`,
    );
  });

  it("imageBlock wraps markdown with newlines", () => {
    const out = new CaretTag({ format: "markdown", imageBlock: true }).transform(
      "a ^giphy:x.gif b",
    );
    expect(out).toBe("a \n\n![x.gif](https://giphy.com/gifs/x.gif)\n\n b");
  });

  it("imageBlock wraps raw with newlines", () => {
    const out = new CaretTag({ format: "raw", imageBlock: true }).transform(
      "a ^giphy:x.gif b",
    );
    expect(out).toBe("a \n\nhttps://giphy.com/gifs/x.gif\n\n b");
  });

  it("imageBlock wraps mfm with newlines", () => {
    const out = new CaretTag({
      format: "mfm",
      imageBlock: true,
      mfm: { instanceBaseUrl: "https://coretalk.space", filesPath: "/files" },
    }).transform("a ^giphy:x.gif b");
    expect(out).toBe(
      "a \n\n![x.gif](https://coretalk.space/files/x.gif)\n\n b",
    );
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
