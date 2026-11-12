/**
 * Full-size file of a featured photo: the 2048 px display. The server serves the original for uploads that have
 * no display, so the swap is safe for every photo.
 */
export const featuredDisplayPath = (originalPath: string) => originalPath.replace(/\/original$/, "/display");
