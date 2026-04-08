import { describe, expect, it } from "vitest";
import { decodeKebabAlt, escapeMarkdownImageAlt } from "../src/alt-text.js";

describe("decodeKebabAlt", () => {
  it("replaces hyphens with spaces", () => {
    expect(decodeKebabAlt("my-cool-image")).toBe("my cool image");
  });
});

describe("escapeMarkdownImageAlt", () => {
  it("escapes brackets and backslashes", () => {
    expect(escapeMarkdownImageAlt("a]b")).toBe("a\\]b");
  });
});
