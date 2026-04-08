import { describe, expect, it } from "vitest";
import {
  buildPortalImageUrl,
  imgurFilenameWithSuffix,
  imgurSuffixForMaxWidthPx,
  parseCssLengthToPx,
  parseImgurStemAndExt,
  resolveImgurThumbnail,
  TENOR_WIDTH_THRESHOLD_PX,
  tenorFilenameForMaxWidthPx,
} from "../src/portal-url.js";

const baseOpts = {
  giphyMediaVariant: "giphy.gif" as const,
  imgurThumbnail: "auto" as const,
};

describe("parseCssLengthToPx", () => {
  it("parses px", () => {
    expect(parseCssLengthToPx("260px")).toBe(260);
    expect(parseCssLengthToPx(" 12.5px ")).toBe(12.5);
  });

  it("returns null for non-px", () => {
    expect(parseCssLengthToPx("100%")).toBe(null);
    expect(parseCssLengthToPx("10em")).toBe(null);
  });
});

describe("tenorFilenameForMaxWidthPx", () => {
  it("uses tenor_s when null or below threshold", () => {
    expect(tenorFilenameForMaxWidthPx(null)).toBe("tenor_s.gif");
    expect(tenorFilenameForMaxWidthPx(300)).toBe("tenor_s.gif");
  });

  it("uses tenor.gif at or above threshold", () => {
    expect(tenorFilenameForMaxWidthPx(TENOR_WIDTH_THRESHOLD_PX)).toBe(
      "tenor.gif",
    );
    expect(tenorFilenameForMaxWidthPx(480)).toBe("tenor.gif");
  });
});

describe("imgurSuffixForMaxWidthPx", () => {
  it("uses m when width is not in px", () => {
    expect(imgurSuffixForMaxWidthPx(null)).toBe("m");
  });

  it("maps max edge to smallest tier that fits", () => {
    expect(imgurSuffixForMaxWidthPx(50)).toBe("s");
    expect(imgurSuffixForMaxWidthPx(100)).toBe("t");
    expect(imgurSuffixForMaxWidthPx(260)).toBe("m");
    expect(imgurSuffixForMaxWidthPx(500)).toBe("l");
    expect(imgurSuffixForMaxWidthPx(900)).toBe("h");
  });

  it("uses original above 1024px", () => {
    expect(imgurSuffixForMaxWidthPx(1200)).toBe(null);
  });
});

describe("parseImgurStemAndExt / imgurFilenameWithSuffix", () => {
  it("inserts size before extension when id has .ext", () => {
    expect(imgurFilenameWithSuffix("abcd123.jpg", "m")).toBe("abcd123m.jpg");
    expect(imgurFilenameWithSuffix("abcd123.jpg", null)).toBe("abcd123.jpg");
  });

  it("uses extensionless stem (no default .gif)", () => {
    expect(parseImgurStemAndExt("abcd123")).toEqual({
      stem: "abcd123",
      ext: "",
    });
    expect(imgurFilenameWithSuffix("abcd123", "m")).toBe("abcd123m");
    expect(imgurFilenameWithSuffix("abcd123", null)).toBe("abcd123");
  });

  it("strips prior size letter when id had explicit extension", () => {
    expect(parseImgurStemAndExt("abcd123m.jpg")).toEqual({
      stem: "abcd123",
      ext: ".jpg",
    });
    expect(imgurFilenameWithSuffix("abcd123m.jpg", "l")).toBe("abcd123l.jpg");
  });
});

describe("resolveImgurThumbnail", () => {
  it("respects original and explicit suffix", () => {
    expect(resolveImgurThumbnail("original", 260)).toBe(null);
    expect(resolveImgurThumbnail("b", 260)).toBe("b");
  });
});

describe("buildPortalImageUrl", () => {
  const tenor = { url: "https://media.tenor.com/", provider: "tenor" as const };
  const imgur = { url: "https://i.imgur.com/", provider: "imgur" as const };
  const giphy = {
    url: "https://media1.giphy.com/media/",
    provider: "giphy" as const,
  };

  it("builds Tenor CDN URL", () => {
    expect(
      buildPortalImageUrl(tenor, "abc", {
        ...baseOpts,
        maxWidthPx: 260,
      }),
    ).toBe("https://media.tenor.com/abc/tenor_s.gif");
  });

  it("builds Imgur URL with size from max width", () => {
    expect(
      buildPortalImageUrl(imgur, "xyz.png", {
        ...baseOpts,
        maxWidthPx: null,
      }),
    ).toBe("https://i.imgur.com/xyzm.png");
    expect(
      buildPortalImageUrl(imgur, "xyz.png", {
        ...baseOpts,
        maxWidthPx: 260,
      }),
    ).toBe("https://i.imgur.com/xyzm.png");
    expect(
      buildPortalImageUrl(imgur, "noext", {
        ...baseOpts,
        maxWidthPx: null,
      }),
    ).toBe("https://i.imgur.com/noextm");
    expect(
      buildPortalImageUrl(imgur, "xyz.png", {
        ...baseOpts,
        maxWidthPx: 1200,
      }),
    ).toBe("https://i.imgur.com/xyz.png");
    expect(
      buildPortalImageUrl(imgur, "xyz.png", {
        ...baseOpts,
        imgurThumbnail: "original",
        maxWidthPx: 260,
      }),
    ).toBe("https://i.imgur.com/xyz.png");
    expect(
      buildPortalImageUrl(imgur, "xyz.png", {
        ...baseOpts,
        imgurThumbnail: "b",
        maxWidthPx: 260,
      }),
    ).toBe("https://i.imgur.com/xyzb.png");
  });

  it("builds Giphy media URL", () => {
    expect(
      buildPortalImageUrl(giphy, "id", {
        ...baseOpts,
        maxWidthPx: null,
      }),
    ).toBe("https://media1.giphy.com/media/id/giphy.gif");
  });

  it("builds Giphy with downsized variant", () => {
    expect(
      buildPortalImageUrl(giphy, "id", {
        ...baseOpts,
        maxWidthPx: null,
        giphyMediaVariant: "downsized.gif",
      }),
    ).toBe("https://media1.giphy.com/media/id/downsized.gif");
  });
});
