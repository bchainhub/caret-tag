# Caret Tag

Lightweight TypeScript helper that finds `^portal:id` markers in text and replaces them with **HTML**, **Markdown**, a **raw URL**, or **Misskey-flavoured Markdown (MFM)**. Only portals you configure (or the built-in defaults) are touched; ids are validated so arbitrary strings cannot be turned into links.

## Install

```bash
npm install caret-tag
```

Requires **Node.js 18+** (or any environment that supports ES modules).

## Usage

Create one **`CaretTag`** instance with your settings, then call **`transform`** on each string.

```ts
import { CaretTag } from "caret-tag";

const text = "Hi ^giphy:cat.gif";

const html = new CaretTag().transform(text);
// => 'Hi <img src="https://giphy.com/gifs/cat.gif" alt="cat.gif" style="max-width:260px;max-height:146px;width:auto;height:auto;object-fit:contain;" />'

const md = new CaretTag({ format: "markdown" }).transform(text);
// => 'Hi ![cat.gif](https://giphy.com/gifs/cat.gif)'

const raw = new CaretTag({ format: "raw" }).transform(text);
// => 'Hi https://giphy.com/gifs/cat.gif'
```

Reuse a single instance when options stay the same:

```ts
const tag = new CaretTag({ format: "markdown" });
tag.transform("^giphy:a.gif");
tag.transform("^tenor:b.gif");
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
new CaretTag({
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

### HTML image size (`format: "html"` only)

HTML output includes a `style` attribute so images stay within a box while keeping aspect ratio: `max-width` and `max-height` with `width:auto`, `height:auto`, and `object-fit:contain`.

- Defaults: **`max-width: 260px`**, **`max-height: 146px`**.
- Override with **`htmlImageSize`**: `{ maxWidth?: string, maxHeight?: string }` (any CSS length, e.g. `"400px"`, `"100%"`).

```ts
new CaretTag({
  htmlImageSize: { maxWidth: "320px", maxHeight: "180px" },
}).transform("^giphy:cat.gif");
```

### Block line (`imageBlock`)

When **`imageBlock: true`**, each replacement is isolated on its own line:

- **`html`** — `<br />` immediately before and after the `<img … />`.
- **`markdown`**, **`raw`**, **`mfm`** — two newlines (`\n\n`) before and after the replacement text.

```ts
new CaretTag({ imageBlock: true }).transform("Hi ^giphy:x.gif end");
// HTML: 'Hi <br /><img … /><br /> end'

new CaretTag({ format: "markdown", imageBlock: true }).transform(
  "Hi ^giphy:x.gif end",
);
// 'Hi \n\n![x.gif](…)\n\n end'
```

### MFM (Misskey)

When `format` is `"mfm"`, you must set `mfm.instanceBaseUrl`. Optionally set `mfm.filesPath` (default `"/files"`).

- If a portal’s normalized URL equals `instanceBaseUrl` + `filesPath` (with a trailing slash), the marker becomes **`$[image id]`** (local file reference).
- Otherwise the marker becomes **`![id](https://<instance><filesPath>/<id>)`** (remote-style fallback).

```ts
new CaretTag({
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

new CaretTag({
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
new CaretTag({
  acceptedExtensions: ["gif", "png", "webp"],
}).transform("^giphy:photo.png");
```

## API

- **`new CaretTag(settings?: CaretTagSettings)`** — store options; throws if `format` is `"mfm"` and `mfm.instanceBaseUrl` is missing.
- **`caretTag.transform(input: string): string`** — replace `^portal:id` markers using the instance settings.
- **`htmlImageSize`** / **`imageBlock`** — see sections above (`CaretTagSettings` in types).
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
