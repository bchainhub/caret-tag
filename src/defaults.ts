import type { PortalMap } from "./types.js";

/** Default portals when `portals` is not set or empty. */
export const DEFAULT_PORTALS: PortalMap = {
  tenor: { url: "https://tenor.com/view/" },
  imgur: { url: "https://imgur.com/" },
  giphy: { url: "https://giphy.com/gifs/" },
  gifbin: { url: "https://gifbin.com/" },
};
