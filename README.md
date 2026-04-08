# Caret Tag

Lightweight TypeScript helper that finds **`^portal:id`** or **`^portal:id:kebab-alt`** markers in text and replaces them with **HTML**, **Markdown**, or a **raw URL**. The **`id`** segment cannot contain **`:`**; an optional third segment sets alt text. If present, it is **always** turned into display text with **`decodeKebabAlt`** (hyphens → spaces) — **not** controlled by **`CaretTag`** settings. Only portals you configure (or the built-in defaults) are touched; ids are validated locally, and by default each emitted **HTTPS image URL** is fetched to confirm a real image is returned (with basic SSRF blocking; plain `http:` is never fetched).

## Install

```bash
npm install caret-tag
```

Requires **Node.js 18+** (or any environment that supports ES modules).

## Usage

Create one **`CaretTag`** instance with your settings, then **`await transform(text)`** (async). By default this checks each target image URL over the network before inserting markup.

```ts
import { CaretTag } from "caret-tag";

const text = "Hi ^imgur:tpTZxoX";

const html = await new CaretTag().transform(text);
// => 'Hi <img src="https://i.imgur.com/tpTZxoXm" style="max-width:260px;width:auto;height:auto;object-fit:contain;" />'  (no alt — omit third segment)

const md = await new CaretTag({ format: "markdown" }).transform(text);
// => 'Hi ![tpTZxoX](https://i.imgur.com/tpTZxoXm)'  (markdown uses id as alt when alt segment omitted)

const raw = await new CaretTag({ format: "raw" }).transform(text);
// => 'Hi https://i.imgur.com/tpTZxoXm'
```

**Offline / no network:** set **`validateImageResource: false`** and use synchronous **`transformSync()`**:

```ts
const tag = new CaretTag({ validateImageResource: false });
tag.transformSync("^imgur:tpTZxoX");
```

Reuse a single instance when options stay the same:

```ts
const tag = new CaretTag({ format: "markdown" });
await tag.transform("^imgur:tpTZxoX");
await tag.transform("^tenor:b");
```

### Formats

| `format` | Result for `^imgur:tpTZxoX` |
| --- | --- |
| `html` (default) | `<img src="https://i.imgur.com/tpTZxoXm" … />` — no **`alt`** unless you add **`^imgur:tpTZxoX:my-label`** (see **HTML image size**) |
| `markdown` | `![tpTZxoX](https://i.imgur.com/tpTZxoXm)` — or `![my label](…)` when a third segment is present |
| `raw` | `https://i.imgur.com/tpTZxoXm` |

### Portals

Each portal is a **name** (used after `^`) and configuration. For a **simple** custom portal, the image URL is `normalizePortalUrl(url) + id`, with a trailing slash added when missing.

Built-in defaults use CDN-specific URL shapes (not plain concatenation):

| Name | Image URL pattern |
| --- | --- |
| `tenor` | `https://media.tenor.com/{id}/tenor.gif` or `…/tenor_s.gif` (see **Tenor** below) |
| `imgur` | `https://i.imgur.com/{hash}{suffix}` or with optional **`.{ext}`** in the id — **`suffix`** from **`imgurThumbnail`** / **`maxWidth`** (see **Imgur** below) |
| `giphy` | `https://media1.giphy.com/media/{id}/{variant}` — **`variant`** from **`giphyMediaVariant`** (see **Giphy variants** below) |

If `portals` is omitted or empty, those three defaults are used. If you pass a non-empty `portals` object, **only** those names are recognised (defaults are not merged).

#### Tenor (`tenor.gif` vs `tenor_s.gif`)

- **`tenor.gif`** — larger asset (often ~480–720px wide), full quality.
- **`tenor_s.gif`** — smaller preview (~160–300px wide), good for feeds.

The library picks the file from your HTML **`max-width`** when it is a pixel length (e.g. `260px`). If that width is **at or above** the midpoint between ~300 and ~480 (see exported **`TENOR_WIDTH_THRESHOLD_PX`**), it uses **`tenor.gif`**; otherwise **`tenor_s.gif`**. Non-`px` widths (e.g. `100%`) fall back to **`tenor_s.gif`**.

Example full-size asset:

`https://media.tenor.com/nDrR1iOWmn0AAAAd/tenor.gif`

With the default **`max-width: 260px`**, the same id resolves to **`tenor_s.gif`** so the preview matches the layout box.

#### Imgur (thumbnail suffix)

By default, ids are **extensionless**: `https://i.imgur.com/abcd123` (full) or `https://i.imgur.com/abcd123m` (thumbnail **`m`** before any optional **`.jpg`** / **`.png`** you put in the id). If you include **`abcd123.jpg`** in the marker, the size letter goes before that extension: `abcd123m.jpg`.

| Suffix | Name | Size |
| --- | --- | --- |
| `s` | Small Square | 90×90 |
| `b` | Big Square | 160×160 |
| `t` | Small Thumbnail | 160px max |
| `m` | Medium Thumbnail | 320px max |
| `l` | Large Thumbnail | 640px max |
| `h` | Huge Thumbnail | 1024px max |

With **`imgurThumbnail: "auto"`** (default), the suffix follows **`htmlImageSize.maxWidth`** when it is a **`px`** value: the smallest tier whose max edge is still large enough for that width (e.g. **`260px`** → **`m`**). Above **1024px** width, the **original** URL (no suffix) is used. When **`maxWidth`** is not pixels (e.g. **`100%`**), **`m`** is used. Override with **`imgurThumbnail: "original"`** or a fixed letter (**`"s"`** … **`"h"`**).

#### Giphy variants

Under `https://media1.giphy.com/media/{id}/`, set **`giphyMediaVariant`** to the filename suffix you want (default **`giphy.gif`**). Tenor-style width logic does not apply to Giphy filenames.

| Type | Example | Use |
| --- | --- | --- |
| Original | `giphy.gif` | best quality |
| Small fixed | `fixed_height_small.gif` | UI thumbnails |
| Medium fixed | `fixed_height.gif` | chat apps |
| Numeric | `200.gif` | simple resizing |
| Optimized | `downsized.gif` | performance |

### Imgur → Markdown

Default Imgur URLs use **`https://i.imgur.com/`** with an **extensionless** image id (e.g. **`tpTZxoX`**); the **`m`** / **`l`** / … letter is inserted after the hash when **`imgurThumbnail`** is **`"auto"`** (see **Imgur** above). You can add **`.jpg`** / **`.png`** / … in the id only if you set **`acceptedExtensions`** accordingly.

For `^imgur:tpTZxoX` with **`format: "markdown"`**, you get `![tpTZxoX](https://i.imgur.com/tpTZxoXm)` (the **id** is the alt text when no third segment). With **`^imgur:tpTZxoX:my-meme`**, markdown becomes `![my meme](https://i.imgur.com/tpTZxoXm)`. With **`format: "html"`**, omit the third segment for no **`alt`** attribute; include it to set **`alt="my meme"`**.

![tpTZxoX](https://i.imgur.com/tpTZxoXm.jpg)

**GitHub** (README, issues, comments, etc.) renders Markdown images. To cap size on GitHub use **`format: "html"`** — the default `<img>` output includes **`max-width:260px`** (and optional **`max-height`** if you set it). You can tune **`htmlImageSize`** for HTML output.

```ts
await new CaretTag({ format: "markdown" }).transform(
  "^imgur:tpTZxoX",
);

await new CaretTag({ format: "html" }).transform(
  "^imgur:tpTZxoX",
);
// → <img … style="max-width:260px;…" /> (no alt) — width-friendly on GitHub
```

### Remote image validation (default on)

When **`validateImageResource`** is **`true`** (default), **`transform()`** uses global **`fetch`** to verify each URL that would be embedded as an image:

- **SSRF:** only **`https:`** URLs (plain `http:` is not allowed); no credentials; blocks `localhost`, private and link-local IPv4, and similar.
- **Content:** prefers **`HEAD`** with `Content-Type: image/*`; otherwise **`GET`** (with `Range` when possible) and checks bytes for common image signatures (GIF, PNG, JPEG, WebP, …).

If validation fails, the **`^portal:id`** segment is **removed** (empty string), so nothing unsafe is embedded.

**Options:** **`fetchTimeoutMs`** (default `10000`) per request chain.

Lower-level helpers are exported: **`isSsrfSafeUrl`**, **`validateRemoteImageResource`**, **`hasImageMagicBytes`**.

### HTML image size (`format: "html"` only)

HTML **`alt`** is **omitted** unless you use a third segment (**`^portal:id:alt-text`**). When present, **`decodeKebabAlt`** always runs on that segment (hyphens → spaces); there is **no** setting to skip or change that. A `style` attribute keeps images within a width box while preserving aspect ratio: default **`max-width: 260px`**, plus `width:auto`, `height:auto`, and `object-fit:contain`.

- **`max-height`** is **omitted** unless you set **`htmlImageSize.maxHeight`**.
- Override with **`htmlImageSize`**: `{ maxWidth?: string, maxHeight?: string }` (any CSS length, e.g. `"400px"`, `"100%"`). Pixel **`max-width`** also drives **Tenor** `tenor.gif` vs `tenor_s.gif` (see above).

```ts
await new CaretTag({
  htmlImageSize: { maxWidth: "320px", maxHeight: "180px" },
}).transform("^imgur:tpTZxoX");
```

### Block line (`imageBlock`)

When **`imageBlock: true`**, each replacement is isolated on its own line:

- **`html`** — `<br />` immediately before and after the `<img … />`.
- **`markdown`**, **`raw`** — two newlines (`\n\n`) before and after the replacement text.

```ts
await new CaretTag({ imageBlock: true }).transform("Hi ^imgur:tpTZxoX end");
// HTML: 'Hi <br /><img … /><br /> end' (no alt without third segment)

await new CaretTag({ format: "markdown", imageBlock: true }).transform(
  "Hi ^imgur:tpTZxoX end",
);
// 'Hi \n\n![tpTZxoX](…)\n\n end'
```

### Image id validation

To avoid turning malicious text into URLs, the `id` segment is checked:

- Rejects `../`, `data:`, `javascript:`, slashes, whitespace, and control characters.
- **Extensions in the id (`file.ext`)** are **off by default**. Set **`enableExtensions: true`** to allow common suffixes (`gif`, `png`, `jpg`, `jpeg`, `webp`) via **`DEFAULT_ID_EXTENSIONS_WHEN_ENABLED`**, or set **`acceptedExtensions`** to an exact list (which overrides **`enableExtensions`**).
- If there is no dot, replacement happens when **`allowExtensionlessIds`** is `true` (default **`true`**), and the id must match `[a-zA-Z0-9_-]+`.

```ts
await new CaretTag({ enableExtensions: true }).transform("^giphy:cat.gif");

await new CaretTag({
  acceptedExtensions: ["gif", "png", "webp"],
}).transform("^giphy:photo.png");
```

## API

- **`new CaretTag(settings?: CaretTagSettings)`** — store options.
- **`await caretTag.transform(input: string): Promise<string>`** — replace `^portal:id` markers; remote image checks when `validateImageResource` is true (default).
- **`caretTag.transformSync(input: string): string`** — synchronous replacement; only when **`validateImageResource: false`** (otherwise throws).
- **`validateImageResource`** / **`fetchTimeoutMs`** / **`enableExtensions`** / **`acceptedExtensions`** / **`giphyMediaVariant`** / **`imgurThumbnail`** / **`htmlImageSize`** / **`imageBlock`** — see sections above (`CaretTagSettings` in types).
- **`DEFAULT_ID_EXTENSIONS_WHEN_ENABLED`** — allowed id suffixes when **`enableExtensions`** is **`true`** and **`acceptedExtensions`** is omitted.
- **`decodeKebabAlt`**, **`escapeMarkdownImageAlt`** — optional alt segment helpers (see marker syntax above).
- **`normalizePortalUrl(url: string)`** — trim and ensure a trailing `/`.
- **`buildPortalImageUrl`**, **`parseCssLengthToPx`**, **`tenorFilenameForMaxWidthPx`**, **`TENOR_WIDTH_THRESHOLD_PX`**, **`imgurSuffixForMaxWidthPx`**, **`resolveImgurThumbnail`**, **`imgurFilenameWithSuffix`**, **`parseImgurStemAndExt`** — portal URL helpers (see **Portals**).
- **`isValidImageId(id, acceptedExtensions, allowExtensionlessIds)`** — same rules as the transformer.
- **`DEFAULT_PORTALS`** — default portal map (exported for reference).

## Development

```bash
npm install
npm test
npm run build
```

## Licence

[CORE License](LICENSE)
