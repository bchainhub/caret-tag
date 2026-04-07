const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_READ_BYTES = 2048;

/** Block common SSRF targets; only `https:` is allowed (not `http:`). */
export function isSsrfSafeUrl(urlString: string): boolean {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") {
    return false;
  }

  if (url.username !== "" || url.password !== "") {
    return false;
  }

  const host = url.hostname.toLowerCase();

  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "metadata.google.internal" ||
    host === "metadata.google.internal."
  ) {
    return false;
  }

  if (host === "::1" || host === "[::1]") {
    return false;
  }

  const ipv4 = parseIpv4(host);
  if (ipv4) {
    return !isNonPublicIpv4(ipv4);
  }

  if (host.startsWith("[") && host.endsWith("]")) {
    const inner = host.slice(1, -1).toLowerCase();
    if (inner === "::1" || inner.endsWith("::1")) return false;
    if (inner.startsWith("fe80:") || inner.startsWith("fc") || inner.startsWith("fd")) {
      return false;
    }
  }

  return true;
}

function parseIpv4(host: string): [number, number, number, number] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number.parseInt(p, 10));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return nums as [number, number, number, number];
}

function isNonPublicIpv4(
  o: readonly [number, number, number, number],
): boolean {
  const [a, b] = o;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && (o[2] === 0 || o[2] === 2)) return true;
  return false;
}

/** Recognise common raster image signatures (first bytes). */
export function hasImageMagicBytes(buf: Uint8Array): boolean {
  if (buf.length < 3) return false;
  // GIF87a / GIF89a
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
  // PNG
  if (
    buf.length >= 4 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return true;
  }
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) return true;
  // WEBP (RIFF....WEBP)
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return true;
  }
  // BMP
  if (buf[0] === 0x42 && buf[1] === 0x4d) return true;
  // ICO
  if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00) {
    return true;
  }
  return false;
}

function contentTypeIsImage(ct: string): boolean {
  return ct.toLowerCase().trim().startsWith("image/");
}

async function readResponsePrefix(
  res: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!res.body) {
    const ab = await res.arrayBuffer();
    return new Uint8Array(ab.slice(0, maxBytes));
  }
  const reader = res.body.getReader();
  const out = new Uint8Array(maxBytes);
  let offset = 0;
  try {
    while (offset < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const take = Math.min(value.length, maxBytes - offset);
      out.set(value.subarray(0, take), offset);
      offset += take;
      if (offset >= maxBytes) {
        await reader.cancel();
        break;
      }
    }
  } catch {
    await reader.cancel().catch(() => {});
  }
  return out.subarray(0, offset);
}

/**
 * Fetch a URL and verify the resource looks like an image (Content-Type and/or magic bytes).
 * Only `https:` URLs are accepted. Uses global `fetch` (Node 18+ / browsers).
 */
export async function validateRemoteImageResource(
  url: string,
  options?: { timeoutMs?: number },
): Promise<boolean> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!isSsrfSafeUrl(url)) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headRes = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });

    const headCt = headRes.headers.get("content-type") ?? "";
    if (headRes.ok && contentTypeIsImage(headCt)) {
      return true;
    }

    const getRes = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: { Range: "bytes=0-4095" },
    });

    const getCt = getRes.headers.get("content-type") ?? "";
    if (getRes.ok || getRes.status === 206) {
      if (contentTypeIsImage(getCt)) return true;
      const prefix = await readResponsePrefix(getRes, MAX_READ_BYTES);
      return hasImageMagicBytes(prefix);
    }

    if (getRes.status === 416) {
      const fullRes = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
      });
      const fullCt = fullRes.headers.get("content-type") ?? "";
      if (fullRes.ok && contentTypeIsImage(fullCt)) return true;
      if (fullRes.ok) {
        const prefix = await readResponsePrefix(fullRes, MAX_READ_BYTES);
        return hasImageMagicBytes(prefix);
      }
    }

    return false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
