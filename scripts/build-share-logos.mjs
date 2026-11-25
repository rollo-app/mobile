// Generates the Instagram, WhatsApp and TikTok logos (share sheet and the welcome screen's social links), as transparent PNGs
// at 28 pt (28/56/84 px). Paths come from simple-icons (viewBox 24). Usage: npm run share-logos
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { siInstagram, siTiktok, siWhatsapp } from "simple-icons";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "share");
mkdirSync(out, { recursive: true });

const svg = (defs, path, fill) => `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  ${defs}
  <path d="${path}" fill="${fill}"/>
</svg>`;

// Instagram brand gradient, diagonal from bottom-left (yellow) to top-right (purple).
const stops = ["#FEDA75", "#FA7E1E", "#D62976", "#962FBF", "#4F5BD5"];
const gradient = `<defs><linearGradient id="ig" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">${stops
  .map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`)
  .join("")}</linearGradient></defs>`;

const logos = {
  instagram: svg(gradient, siInstagram.path, "url(#ig)"),
  // Solid white glyph for colored buttons (Instagram's guidelines allow it).
  "instagram-white": svg("", siInstagram.path, "#FFFFFF"),
  whatsapp: svg("", siWhatsapp.path, "#25D366"),
  // Plain glyphs the app tints with a system color (the welcome screen's links to Rollo Project's accounts).
  "instagram-mono": svg("", siInstagram.path, "#000000"),
  "tiktok-mono": svg("", siTiktok.path, "#000000"),
};

for (const [name, source] of Object.entries(logos)) {
  for (const scale of [1, 2, 3]) {
    const file = `${name}${scale === 1 ? "" : `@${scale}x`}.png`;
    const image = new Resvg(source, { fitTo: { mode: "width", value: 28 * scale } }).render();
    writeFileSync(join(out, file), image.asPng());
    console.log(`assets/share/${file} (${image.width}x${image.height})`);
  }
}
