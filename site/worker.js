import { withRange } from "../scripts/site/range.js";

const RANGED = new Set(["/hero.mp4", "/hero.webm"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (
      RANGED.has(url.pathname) &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      const full = await env.ASSETS.fetch(new Request(url, { method: "GET" }));
      if (full.status !== 200) return full;
      return withRange(request, full);
    }
    return env.ASSETS.fetch(request);
  },
};
