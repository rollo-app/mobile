// Generates Rollo's icon and splash from SVG ("Revelado" logo: three circles that
// concentrate toward the top right). Usage: npm run icons
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const assets = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
mkdirSync(assets, { recursive: true });

/** The three circles, on a 120×120 square. `o` are the opacities [large, medium, small]. */
const circles = (fill, o) => `
  <circle cx="60" cy="60" r="34" fill="${fill}" fill-opacity="${o[0]}"/>
  <circle cx="66" cy="54" r="24" fill="${fill}" fill-opacity="${o[1]}"/>
  <circle cx="71" cy="49" r="14" fill="${fill}" fill-opacity="${o[2]}"/>`;

const COBALT = "#3155F5";
const COBALT_DARK = "#5C7CFF";

/** 1024×1024 icon: full square, no rounded corners (iOS adds them). */
const icon = ({ background, fill, opacities }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${background ? `<rect width="1024" height="1024" fill="${background}"/>` : ""}
  <g transform="translate(512 512) scale(9) translate(-60 -60)">${circles(fill, opacities)}</g>
</svg>`;

/** Splash: just the logo, no frame, cropped to the circles. */
const splash = (fill) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="22 22 76 76">
  ${circles(fill, [0.18, 0.38, 1])}
</svg>`;

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
};

/** 8-bit RGB PNG, no alpha channel: the App Store rejects an icon with transparency. */
function opaquePng({ width, height, pixels }) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height); // each row starts with its filter byte (0)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4;
      const to = y * (stride + 1) + 1 + x * 3;
      raw[to] = pixels[from];
      raw[to + 1] = pixels[from + 1];
      raw[to + 2] = pixels[from + 2];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Icons with a background carry no transparency; the tinted one and the splash do (they're just the logo). */
const opaque = new Set(["icon.png", "icon-dark.png"]);

const files = {
  "icon.png": icon({ background: "#F2F0EB", fill: COBALT, opacities: [0.18, 0.38, 1] }),
  "icon-dark.png": icon({ background: "#0E0F14", fill: COBALT_DARK, opacities: [0.22, 0.45, 1] }),
  // Tinted: iOS tints it according to the wallpaper; it's grayscale on transparent.
  "icon-tinted.png": icon({ background: null, fill: "#FFFFFF", opacities: [0.3, 0.6, 1] }),
  "splash-icon.png": splash(COBALT),
  "splash-icon-dark.png": splash(COBALT_DARK),
};

for (const [name, svg] of Object.entries(files)) {
  const image = new Resvg(svg, { fitTo: { mode: "width", value: 1024 } }).render();
  writeFileSync(join(assets, name), opaque.has(name) ? opaquePng(image) : image.asPng());
  console.log(`assets/${name}`);
}
