import type { PortalMap } from "./types.js";

/** Default portals when `portals` is not set or empty. */
export const DEFAULT_PORTALS: PortalMap = {
  tenor: { url: "https://media.tenor.com/", provider: "tenor" },
  imgur: { url: "https://i.imgur.com/", provider: "imgur" },
  giphy: { url: "https://media1.giphy.com/media/", provider: "giphy" },
};
