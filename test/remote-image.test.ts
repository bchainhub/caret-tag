import { describe, expect, it } from "vitest";
import {
  hasImageMagicBytes,
  isSsrfSafeUrl,
} from "../src/remote-image.js";

describe("isSsrfSafeUrl", () => {
  it("allows public https URLs", () => {
    expect(isSsrfSafeUrl("https://giphy.com/gifs/x.gif")).toBe(true);
  });

  it("blocks plain http", () => {
    expect(isSsrfSafeUrl("http://example.com/x.gif")).toBe(false);
  });

  it("blocks localhost and loopback", () => {
    expect(isSsrfSafeUrl("http://localhost/foo.gif")).toBe(false);
    expect(isSsrfSafeUrl("http://127.0.0.1/foo.gif")).toBe(false);
    expect(isSsrfSafeUrl("http://0.0.0.0/foo.gif")).toBe(false);
  });

  it("blocks private IPv4", () => {
    expect(isSsrfSafeUrl("http://192.168.1.1/x.gif")).toBe(false);
    expect(isSsrfSafeUrl("http://10.0.0.1/x.gif")).toBe(false);
    expect(isSsrfSafeUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
  });

  it("blocks non-https schemes", () => {
    expect(isSsrfSafeUrl("file:///etc/passwd")).toBe(false);
    expect(isSsrfSafeUrl("data:image/gif;base64,xx")).toBe(false);
  });

  it("blocks credentials in URL", () => {
    expect(isSsrfSafeUrl("https://user:pass@example.com/x.gif")).toBe(false);
  });
});

describe("hasImageMagicBytes", () => {
  it("detects GIF signature", () => {
    const buf = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(hasImageMagicBytes(buf)).toBe(true);
  });

  it("detects PNG signature", () => {
    const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(hasImageMagicBytes(buf)).toBe(true);
  });
});
