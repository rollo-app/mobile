/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

let dist: string;

beforeAll(() => {
  dist = mkdtempSync(join(tmpdir(), "rollo-landing-"));
  execFileSync(process.execPath, [join(__dirname, "..", "build-site.mjs")], { env: { ...process.env, SITE_DIST: dist } });
});
afterAll(() => rmSync(dist, { recursive: true, force: true }));

const read = (path: string) => readFileSync(join(dist, path), "utf8");

describe("the /soporte page", () => {
  it("has its own title, the support email and the FAQ", () => {
    const html = read("soporte/index.html");
    expect(html).toContain("<title>Soporte · Rollo</title>");
    expect(html).toContain("mailto:soporte@juanifraga.com");
    for (const q of [
      "&iquest;C&oacute;mo me sumo a un rollo?",
      "&iquest;C&oacute;mo borro mi cuenta?",
      "&iquest;C&oacute;mo denuncio una foto o bloqueo a alguien?",
      "&iquest;Hay versi&oacute;n para Android?",
    ]) {
      expect(html).toContain(q);
    }
  });

  it("is linked from the footer of every page", () => {
    expect(read("privacidad/index.html")).toContain('href="/soporte"');
  });

  it("is linked from the home through an element with id soporte", () => {
    expect(read("index.html")).toMatch(/id="soporte"[^>]*href="\/soporte"|href="\/soporte"[^>]*id="soporte"/);
  });
});

const TESTFLIGHT = "https://testflight.apple.com/join/Q557gZkR";
const SITE = "https://rollo.juanifraga.com";
const visibleText = (html: string) =>
  html
    .replace(/<head>[\s\S]*?<\/head>/, "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, "")
    .replace(/<[^>]+>/g, " ");

describe("the home", () => {
  let html: string;
  beforeAll(() => {
    html = read("index.html");
  });
  const section = (id: string) => html.match(new RegExp(`<section[^>]*id="${id}"[\\s\\S]*?</section>`))?.[0] ?? "";

  it("has the 7 sections in the order a rollo is lived", () => {
    const ids = ["inicio", "como-funciona", "mapa", "revelado", "perfil", "privado", "cierre"];
    const positions = ids.map((id) => html.indexOf(`id="${id}"`));
    for (const p of positions) expect(p).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("marks every section but the first one for the entrance animation", () => {
    expect(html).not.toMatch(/<section[^>]*id="inicio"[^>]*data-enter/);
    for (const id of ["como-funciona", "mapa", "revelado", "perfil", "privado", "cierre"]) {
      expect(html).toMatch(new RegExp(`<section[^>]*id="${id}"[^>]*data-enter|<section[^>]*data-enter[^>]*id="${id}"`));
    }
  });

  it("has the TestFlight button in the hero and in the closing, with the iPhone-only line", () => {
    const links = [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].filter((m) => m[1] === TESTFLIGHT);
    expect(links).toHaveLength(2);
    for (const link of links) expect(link[2]).toContain("Probar la beta en iPhone");
    for (const id of ["inicio", "cierre"]) {
      expect(section(id)).toContain(TESTFLIGHT);
      expect(section(id)).toContain("Solo para iPhone · Gratis");
    }
  });

  it("has a serif headline in the hero and is in Spanish", () => {
    expect(section("inicio")).toMatch(/<h1[^>]*class="[^"]*\bserif\b/);
    expect(html).toContain('<html lang="es">');
  });

  it("has a mockup slot with a phone frame for each screen", () => {
    for (const id of ["inicio", "como-funciona", "mapa", "revelado", "perfil"]) {
      expect(section(id)).toMatch(new RegExp(`<div class="shot" data-shot="${id}">\\s*<div class="phone"`));
    }
    expect(section("como-funciona").match(/data-shot="como-funciona"/g)).toHaveLength(3);
  });

  it("keeps the old /#soporte anchor landing on the support link", () => {
    expect(section("cierre")).toMatch(/id="soporte"[^>]*href="\/soporte"|href="\/soporte"[^>]*id="soporte"/);
  });

  it("has Open Graph, canonical and theme-color for sharing the link", () => {
    const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? "";
    expect(head).toContain(`<meta property="og:image" content="${SITE}/og.png">`);
    expect(head).toMatch(/<meta property="og:title" content="[^"]+">/);
    expect(head).toMatch(/<meta property="og:description" content="[^"]+">/);
    expect(head).toContain(`<link rel="canonical" href="${SITE}/">`);
    expect(head).toContain('<meta name="theme-color" media="(prefers-color-scheme: light)" content="#F2F0EB">');
    expect(head).toContain('<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0E0F14">');
  });

  it("makes no requests to third parties and only links out to TestFlight", () => {
    for (const [, url] of html.matchAll(/\bsrc="([^"]*)"/g)) expect(url).not.toMatch(/^(https?:)?\/\//);
    for (const [, url] of html.matchAll(/<link\b[^>]*href="([^"]*)"/g)) {
      if (/^(https?:)?\/\//.test(url!)) expect(url!.startsWith(`${SITE}/`)).toBe(true);
    }
    for (const [, url] of html.matchAll(/<a\b[^>]*href="(https?:[^"]*)"/g)) expect(url).toBe(TESTFLIGHT);
  });
});

describe("the home mockups", () => {
  let html: string;
  beforeAll(() => {
    html = read("index.html");
  });
  const section = (id: string) => html.match(new RegExp(`<section[^>]*id="${id}"[\\s\\S]*?</section>`))?.[0] ?? "";
  const figures = () => [...html.matchAll(/<figure\b([^>]*)>([\s\S]*?)<\/figure>/g)];

  it("draws a phone with app content in every slot", () => {
    const slots = [...html.matchAll(/data-shot="([^"]+)">\s*(<div class="phone"[\s\S]*?)<\/figure>/g)];
    expect(slots.map((s) => s[1])).toEqual(["inicio", "como-funciona", "como-funciona", "como-funciona", "mapa", "revelado", "perfil"]);
    for (const [, , phone] of slots) {
      expect(phone).toMatch(/<div class="screen m-[a-z]+"><div class="status">[\s\S]*<\/div>\s*<\/div>\s*<\/div>\s*$/);
    }
  });

  it("hides every mockup from screen readers and labels every figure in Spanish", () => {
    const all = figures();
    expect(all).toHaveLength(7);
    for (const [, attrs, inner] of all) {
      expect(attrs).toMatch(/aria-label="[^"]*[a-záéíóúñ]{3,}[^"]*"/);
      expect(inner).toMatch(/^<div class="shot" data-shot="[^"]+">\s*<div class="phone" aria-hidden="true">/);
    }
  });

  it("has at least 9 photos to reveal in the reveal section", () => {
    const photos = section("revelado").match(/<span class="photo"[^>]*\bdata-reveal\b/g) ?? [];
    expect(photos.length).toBeGreaterThanOrEqual(9);
  });

  it("paints photos as color blobs, sharp in the static CSS", () => {
    expect(section("inicio")).toMatch(/<span class="photo" style="--a:#[0-9a-f]{6};--b:#[0-9a-f]{6}"/);
    const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
    expect(style).toContain("linear-gradient(135deg,var(--a),var(--b))");
    const unscoped = style
      .split("}")
      .map((rule) => rule.split("{"))
      .filter(([selector, body]) => body && /filter:\s*blur/.test(body) && !/\.js-motion/.test(selector!));
    expect(unscoped).toEqual([]);
    expect(style).toMatch(/\.js-motion #revelado \.photo\[data-reveal\]\{[^}]*filter:blur\(10px\) sepia\(\.8\)/);
    expect(style).toMatch(/\.js-motion \[data-enter\]\{opacity:0;transform:translateY\(16px\)\}/);
  });

  it("shows the map pins with initials, the feed row and the profile header", () => {
    expect(section("mapa")).toMatch(/class="pin"[^>]*>C</);
    expect(section("mapa")).toContain("Cami sacó una foto · 14:32");
    expect(section("perfil")).toMatch(/@\w+/);
    expect(section("perfil")).toMatch(/Fotos[\s\S]*Mapa/);
  });
});

describe("the home in App Store mode", () => {
  const homeModule = join(__dirname, "..", "site", "home.mjs");
  const render = (storeMode: string) =>
    JSON.parse(
      execFileSync(process.execPath, [
        "--input-type=module",
        "-e",
        `import { homeHtml } from ${JSON.stringify(homeModule)};
         process.stdout.write(JSON.stringify(homeHtml({ storeMode: ${JSON.stringify(storeMode)}, testflightUrl: "${TESTFLIGHT}",
           appStoreUrl: "https://apps.apple.com/app/id6825843502", siteUrl: "${SITE}" })));`,
      ]).toString(),
    ) as { head: string; body: string };

  it("swaps the button for the official badge, keeps the iPhone-only line and never says beta", () => {
    const { body } = render("appstore");
    const badges = body.match(
      /<a\b[^>]*href="https:\/\/apps\.apple\.com\/app\/id6825843502"[^>]*>\s*<img src="\/app-store-badge\.svg" alt="Descargar en el App Store" width="156" height="52">\s*<\/a>/g,
    );
    expect(badges).toHaveLength(2);
    expect(body).not.toContain(TESTFLIGHT);
    expect(body.match(/Solo para iPhone · Gratis/g)).toHaveLength(2);
    expect(visibleText(body).toLowerCase()).not.toContain("beta");
  });

  it("fails the build when the official badge file is missing", () => {
    const out = mkdtempSync(join(tmpdir(), "rollo-landing-appstore-"));
    try {
      let stderr = "";
      expect(() => {
        try {
          execFileSync(process.execPath, [join(__dirname, "..", "build-site.mjs")], {
            env: { ...process.env, SITE_DIST: out, SITE_STORE_MODE: "appstore" },
            stdio: "pipe",
          });
        } catch (error) {
          stderr = String((error as { stderr?: Buffer }).stderr);
          throw error;
        }
      }).toThrow();
      expect(stderr).toContain("app-store-badge.svg");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});

describe("the home CTA contrast", () => {
  it("is large text (bold, ≥ 19px) so white on the dark-mode tint passes AA", () => {
    const style = read("index.html").match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
    const rule = style.match(/(?:^|[}\s])\.btn\{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toContain("font-weight:700");
    expect(Number(rule.match(/font-size:(\d+(?:\.\d+)?)px/)?.[1])).toBeGreaterThanOrEqual(19);
  });
});

describe("the home motion", () => {
  const html = () => read("index.html");

  it("ships a Motion bundle under 30 KB gzipped and the landing script", () => {
    expect(existsSync(join(dist, "motion.js"))).toBe(true);
    expect(gzipSync(readFileSync(join(dist, "motion.js"))).length).toBeLessThanOrEqual(30000);
    expect(existsSync(join(dist, "landing.js"))).toBe(true);
  });

  it("loads motion.js before landing.js, both deferred", () => {
    const a = html().indexOf('<script src="/motion.js" defer></script>');
    const b = html().indexOf('<script src="/landing.js" defer></script>');
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
  });

  describe("head script", () => {
    const script = () => html().match(/<head>[\s\S]*?<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
    const run = (matches: boolean) => {
      const add = jest.fn();
      new Function("document", "matchMedia", script())({ documentElement: { classList: { add } } }, () => ({ matches }));
      return add;
    };

    it("enables js-motion unless Reduce Motion is on", () => {
      expect(run(false)).toHaveBeenCalledWith("js-motion");
      expect(run(true)).not.toHaveBeenCalled();
    });
  });
});
