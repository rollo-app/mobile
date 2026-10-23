// Generates the Open Graph image for the public site (1200×630) from SVG.
// Run once on the Mac (needs the system serif font) and commit the result: npm run og
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "site", "og.png");

const SERIF = "New York, Georgia, serif";
const SANS = "Helvetica Neue, Helvetica, Arial, sans-serif";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#F2F0EB"/>
  <g transform="translate(96 88) scale(0.7) translate(-22 -22)" fill="#3155F5">
    <circle cx="60" cy="60" r="34" fill-opacity="0.18"/>
    <circle cx="66" cy="54" r="24" fill-opacity="0.38"/>
    <circle cx="71" cy="49" r="14"/>
  </g>
  <text x="168" y="130" font-family="${SERIF}" font-size="44" font-weight="600" fill="#1C1C1E">Rollo</text>
  <text font-family="${SERIF}" font-size="96" font-weight="600" fill="#1C1C1E">
    <tspan x="96" y="338">Sacá la foto.</tspan>
    <tspan x="96" y="448">Mirala después.</tspan>
  </text>
  <text x="96" y="545" font-family="${SANS}" font-size="30" fill="#6c6c70">Solo para iPhone</text>
</svg>`;

const image = new Resvg(svg, {
  fitTo: { mode: "width", value: 1200 },
  font: { loadSystemFonts: true },
}).render();
writeFileSync(out, image.asPng());
console.log("scripts/site/og.png");
