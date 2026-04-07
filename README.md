# Caret Tag

Lightweight TypeScript helper that finds `^portal:id` markers in text and replaces them with **HTML**, **Markdown**, a **raw URL**, or **Misskey-flavoured Markdown (MFM)**. Only portals you configure (or the built-in defaults) are touched; ids are validated locally, and by default each emitted **HTTPS image URL** is fetched to confirm a real image is returned (with basic SSRF blocking; plain `http:` is never fetched).

## Install

```bash
npm install caret-tag
```

Requires **Node.js 18+** (or any environment that supports ES modules).

## Usage

Create one **`CaretTag`** instance with your settings, then **`await transform(text)`** (async). By default this checks each target image URL over the network before inserting markup.

```ts
import { CaretTag } from "caret-tag";

const text = "Hi ^giphy:cat.gif";

const html = await new CaretTag().transform(text);
// => 'Hi <img src="https://giphy.com/gifs/cat.gif" alt="cat.gif" style="max-width:260px;max-height:146px;width:auto;height:auto;object-fit:contain;" />'

const md = await new CaretTag({ format: "markdown" }).transform(text);
// => 'Hi ![cat.gif](https://giphy.com/gifs/cat.gif)'

const raw = await new CaretTag({ format: "raw" }).transform(text);
// => 'Hi https://giphy.com/gifs/cat.gif'
```

**Offline / no network:** set **`validateImageResource: false`** and use synchronous **`transformSync()`**:

```ts
const tag = new CaretTag({ validateImageResource: false });
tag.transformSync("^giphy:a.gif");
```

Reuse a single instance when options stay the same:

```ts
const tag = new CaretTag({ format: "markdown" });
await tag.transform("^giphy:a.gif");
await tag.transform("^tenor:b.gif");
```

### Formats

| `format` | Result for `^giphy:cat.gif` |
| --- | --- |
| `html` (default) | `<img … style="max-width:260px;max-height:146px;…" />` (see **HTML image size**) |
| `markdown` | `![cat.gif](https://giphy.com/gifs/cat.gif)` |
| `raw` | `https://giphy.com/gifs/cat.gif` |
| `mfm` | See below |

### Portals

Each portal is a **name** (used after `^`) and a **base URL**. The final image URL is `baseUrl` + `id`, with a trailing slash added to `baseUrl` when it is missing.

```ts
await new CaretTag({
  portals: {
    cats: { url: "https://example.com/cdn" },
  },
  format: "markdown",
}).transform("^cats:fluffy.gif");
// => '![fluffy.gif](https://example.com/cdn/fluffy.gif)'
```

If `portals` is omitted or empty, these defaults are used:

| Name | Base URL |
| --- | --- |
| `tenor` | `https://tenor.com/view/` |
| `imgur` | `https://imgur.com/` |
| `giphy` | `https://giphy.com/gifs/` |
| `gifbin` | `https://gifbin.com/` |

If you pass a non-empty `portals` object, **only** those names are recognised (defaults are not merged).

### Remote image validation (default on)

When **`validateImageResource`** is **`true`** (default), **`transform()`** uses global **`fetch`** to verify each URL that would be embedded as an image:

- **SSRF:** only **`https:`** URLs (plain `http:` is not allowed); no credentials; blocks `localhost`, private and link-local IPv4, and similar.
- **Content:** prefers **`HEAD`** with `Content-Type: image/*`; otherwise **`GET`** (with `Range` when possible) and checks bytes for common image signatures (GIF, PNG, JPEG, WebP, …).

If validation fails, the **`^portal:id`** segment is **removed** (empty string), so nothing unsafe is embedded.

**MFM** local files (`$[image id]` when the portal matches the instance files base) **does not** perform a fetch (no HTTP URL is emitted).

**Options:** **`fetchTimeoutMs`** (default `10000`) per request chain.

Lower-level helpers are exported: **`isSsrfSafeUrl`**, **`validateRemoteImageResource`**, **`hasImageMagicBytes`**.

### HTML image size (`format: "html"` only)

HTML output includes a `style` attribute so images stay within a box while keeping aspect ratio: `max-width` and `max-height` with `width:auto`, `height:auto`, and `object-fit:contain`.

- Defaults: **`max-width: 260px`**, **`max-height: 146px`**.
- Override with **`htmlImageSize`**: `{ maxWidth?: string, maxHeight?: string }` (any CSS length, e.g. `"400px"`, `"100%"`).

```ts
await new CaretTag({
  htmlImageSize: { maxWidth: "320px", maxHeight: "180px" },
}).transform("^giphy:cat.gif");
```

### Block line (`imageBlock`)

When **`imageBlock: true`**, each replacement is isolated on its own line:

- **`html`** — `<br />` immediately before and after the `<img … />`.
- **`markdown`**, **`raw`**, **`mfm`** — two newlines (`\n\n`) before and after the replacement text.

```ts
await new CaretTag({ imageBlock: true }).transform("Hi ^giphy:x.gif end");
// HTML: 'Hi <br /><img … /><br /> end'

await new CaretTag({ format: "markdown", imageBlock: true }).transform(
  "Hi ^giphy:x.gif end",
);
// 'Hi \n\n![x.gif](…)\n\n end'
```

### MFM (Misskey)

When `format` is `"mfm"`, you must set `mfm.instanceBaseUrl`. Optionally set `mfm.filesPath` (default `"/files"`).

- If a portal’s normalized URL equals `instanceBaseUrl` + `filesPath` (with a trailing slash), the marker becomes **`$[image id]`** (local file reference).
- Otherwise the marker becomes **`![id](https://<instance><filesPath>/<id>)`** (remote-style fallback).

```ts
await new CaretTag({
  format: "mfm",
  portals: {
    files: { url: "https://coretalk.space/files" },
  },
  mfm: {
    instanceBaseUrl: "https://coretalk.space",
    filesPath: "/files",
  },
}).transform("^files:abc.gif");
// => '$[image abc.gif]'

await new CaretTag({
  format: "mfm",
  mfm: { instanceBaseUrl: "https://coretalk.space", filesPath: "/files" },
}).transform("^giphy:abc.gif");
// => '![abc.gif](https://coretalk.space/files/abc.gif)'
```

### Image id validation

To avoid turning malicious text into URLs, the `id` segment is checked:

- Rejects `../`, `data:`, `javascript:`, slashes, whitespace, and control characters.
- If the id contains a file extension, it must be one of **`acceptedExtensions`** (default: **`gif`** only).
- If there is no extension, replacement only happens when **`allowExtensionlessIds`** is `true` (default **`false`**), and the id must match `[a-zA-Z0-9_-]+`.

```ts
await new CaretTag({
  acceptedExtensions: ["gif", "png", "webp"],
}).transform("^giphy:photo.png");
```

## API

- **`new CaretTag(settings?: CaretTagSettings)`** — store options; throws if `format` is `"mfm"` and `mfm.instanceBaseUrl` is missing.
- **`await caretTag.transform(input: string): Promise<string>`** — replace `^portal:id` markers; remote image checks when `validateImageResource` is true (default).
- **`caretTag.transformSync(input: string): string`** — synchronous replacement; only when **`validateImageResource: false`** (otherwise throws).
- **`validateImageResource`** / **`fetchTimeoutMs`** / **`htmlImageSize`** / **`imageBlock`** — see sections above (`CaretTagSettings` in types).
- **`normalizePortalUrl(url: string)`** — trim and ensure a trailing `/`.
- **`portalMatchesInstanceFiles(portalUrlNormalized, instanceBaseUrl, filesPath?)`** — whether a portal points at the instance files base (for MFM).
- **`isValidImageId(id, acceptedExtensions, allowExtensionlessIds)`** — same rules as the transformer.
- **`DEFAULT_PORTALS`** — default portal map (exported for reference).

## Development

```bash
npm install
npm test
npm run build
```

## GitHub Actions

- **CI** (`.github/workflows/ci.yml`) runs tests and build on pushes and pull requests to `main` / `master`.
- **Release** (`.github/workflows/release.yml`) runs on tags `v*` and publishes to npm. Add an **`NPM_TOKEN`** secret with publish rights in the repository settings.

## Licence

[CORE License](LICENSE)
