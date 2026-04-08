/** Reject obvious non-image / injection patterns in the id segment. */
const UNSAFE_ID = /[/\\]|javascript:|data:|vbscript:|\s|[\u0000-\u001f\u007f]/i;

const MAX_ID_LENGTH = 512;

/**
 * Validates the id part of `^portal:id` for safe image-like use.
 *
 * - If the id contains a dot, the segment after the last dot must be in `acceptedExtensions` (lowercase, no dot). With **`acceptedExtensions: []`**, any id that contains **`.`** is rejected.
 * - If there is no dot, the id is allowed when `allowExtensionlessIds` is `true` (default) and the id matches `[a-zA-Z0-9_-]+`.
 */
export function isValidImageId(
  id: string,
  acceptedExtensions: string[],
  allowExtensionlessIds: boolean,
): boolean {
  if (!id || id.length > MAX_ID_LENGTH) return false;
  if (UNSAFE_ID.test(id)) return false;

  const lower = id.toLowerCase();
  const lastDot = lower.lastIndexOf(".");
  if (lastDot === -1) {
    return (
      allowExtensionlessIds && /^[a-zA-Z0-9_-]+$/.test(id)
    );
  }

  const ext = lower.slice(lastDot + 1);
  if (!ext || ext.length > 16) return false;
  return acceptedExtensions.includes(ext);
}
