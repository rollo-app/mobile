/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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

  it("has exactly the four sections, in order", () => {
    const ids = [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["inicio", "mapa", "revelado", "cierre"]);
    for (const gone of ["como-funciona", "momento", "perfil", "privado"]) expect(html).not.toContain(`id="${gone}"`);
  });

  it("marks every section but the first one for the entrance animation", () => {
    expect(html).not.toMatch(/<section[^>]*id="inicio"[^>]*data-enter/);
    for (const id of ["mapa", "revelado", "cierre"]) {
      expect(html).toMatch(new RegExp(`<section[^>]*id="${id}"[^>]*data-enter|<section[^>]*data-enter[^>]*id="${id}"`));
    }
  });

  it("has the exact copy", () => {
    const text = visibleText(html).replace(/\s+/g, " ");
    for (const copy of [
      "Un rollo compartido con tus amigos para el viaje, el casamiento o la última semana de facu. Cada uno saca sus fotos y nadie las ve hasta el revelado.",
      "Ves dónde sacan, no qué sacan.",
      "Mientras dura el rollo, el mapa se llena con los pins del grupo: quién sacó, dónde y a qué hora. Las fotos siguen ocultas. Sin señal, se guardan y se suben solas cuando vuelve.",
      "Todas juntas, al final del viaje.",
      "Cuando termina el rollo se revelan las fotos de todos a la vez, y ahí descubrís cómo lo vivió cada uno. Una vez por día, el momento te avisa para sacar una foto con las dos cámaras. Las mejores van a tu perfil.",
      "Estrenalo en tu próximo viaje.",
      "Tus fotos solo las ven las personas de tu rollo.",
    ]) {
      expect(text).toContain(copy);
    }
    expect(section("inicio")).toContain("Sacá la foto.<br>Mirala después.");
  });

  it("shows the map and reveal stills in a phone frame, lazy and with their size", () => {
    for (const [id, file, label] of [
      ["mapa", "map.jpg", "El mapa del rollo con los pins del grupo en Budapest"],
      ["revelado", "reveal.jpg", "El revelado del rollo Europa"],
    ]) {
      const s = section(id!);
      expect(s).toContain(`aria-label="${label}"`);
      expect(s).toMatch(new RegExp(`<div class="phone"><img class="shot-img" src="/${file}"[^>]*loading="lazy"[^>]*decoding="async"[^>]*width="540"[^>]*height="1170">`));
    }
  });

  it("copies the section stills to dist and fails the build naming npm run render when one is missing", () => {
    for (const f of ["map.jpg", "reveal.jpg"]) expect(existsSync(join(dist, f))).toBe(true);
    const empty = mkdtempSync(join(tmpdir(), "rollo-stills-empty-"));
    try {
      for (const f of ["hero.mp4", "hero.webm", "hero-poster.jpg", "map.jpg"]) copyFileSync(join(dist, f), join(empty, f));
      expect(() =>
        execFileSync(process.execPath, [join(__dirname, "..", "build-site.mjs")], {
          env: { ...process.env, SITE_DIST: mkdtempSync(join(tmpdir(), "rollo-landing-y-")), SITE_HERO_DIR: empty },
          stdio: "pipe",
        }),
      ).toThrow(/Missing reveal\.jpg[\s\S]*npm run render/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
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

  it("has a phone frame in each of the first three sections", () => {
    for (const id of ["inicio", "mapa", "revelado"]) {
      expect(section(id)).toMatch(new RegExp(`<div class="shot" data-shot="${id}">\\s*<div class="phone"`));
    }
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

describe("the hero video", () => {
  const html = () => read("index.html");
  const hero = () => html().match(/<section[^>]*id="inicio"[\s\S]*?<\/section>/)?.[0] ?? "";

  it("plays a muted looping video inside the phone frame, with the poster and both sources", () => {
    const h = hero();
    expect(h).toMatch(/<div class="phone">\s*<video class="hero-video"[^>]*aria-hidden="true"/);
    expect(h).toContain('aria-label="La app en uso: sacás la foto, el mapa del grupo, el revelado y tu perfil"');
    for (const needle of ["hero.webm", "hero.mp4", 'poster="/hero-poster.jpg"', " muted", " autoplay", " loop", " playsinline"]) {
      expect(h).toContain(needle);
    }
    expect(h).not.toContain('class="screen m-roll"');
    expect(h).toMatch(/<figure class="figure" aria-label="[^"]+"/);
  });

  it("copies the three hero files to dist", () => {
    for (const f of ["hero.mp4", "hero.webm", "hero-poster.jpg"]) expect(existsSync(join(dist, f))).toBe(true);
  });

  it("fails the build naming npm run render when a hero file is missing", () => {
    const empty = mkdtempSync(join(tmpdir(), "rollo-hero-empty-"));
    try {
      expect(() =>
        execFileSync(process.execPath, [join(__dirname, "..", "build-site.mjs")], {
          env: { ...process.env, SITE_DIST: mkdtempSync(join(tmpdir(), "rollo-landing-x-")), SITE_HERO_DIR: empty },
          stdio: "pipe",
        }),
      ).toThrow(/npm run render/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("the home layout", () => {
  const style = () => read("index.html").match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";

  it("hides content only under js-motion, so it shows without JS", () => {
    const hiding = style()
      .split("}")
      .map((rule) => rule.split("{"))
      .filter(([, body]) => body && /opacity:\s*0\b/.test(body));
    expect(hiding.length).toBeGreaterThan(0);
    for (const [selector] of hiding) expect(selector!.trim()).toMatch(/^\.js-motion /);
  });

  it("uses one gutter and a fixed spacing scale", () => {
    const css = style();
    expect(css).toContain("--gutter:20px");
    for (const token of ["--s-text:16px", "--s-cta:24px", "--s-figure:32px", "--s-section:80px"]) expect(css).toContain(token);
    expect(css).toMatch(/\.figure\{[^}]*justify-content:flex-start/);
    expect(css).toMatch(/\.phone\{width:min\(74vw,280px\)/);
  });

  it("has no leftover mockup, moment or Lottie code", () => {
    const html = read("index.html");
    for (const needle of ["moment-mark", "lottie", "data-reveal", "m-roll"]) expect(html).not.toContain(needle);
    for (const f of ["lottie.js", "moment-intro-light.json", "moment-intro-dark.json"]) expect(existsSync(join(dist, f))).toBe(false);
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
            env: { ...process.env, SITE_DIST: out, SITE_STORE_MODE: "appstore", SITE_APP_STORE_BADGE: join(out, "missing", "app-store-badge.svg") },
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
      const classes = new Set<string>();
      const root = {
        dataset: {} as Record<string, string>,
        classList: { add: jest.fn((c: string) => classes.add(c)), remove: jest.fn((c: string) => classes.delete(c)) },
      };
      const addEventListener = jest.fn();
      new Function("document", "matchMedia", script())({ documentElement: root, addEventListener }, () => ({ matches }));
      return { root, classes, addEventListener };
    };

    it("enables js-motion unless Reduce Motion is on", () => {
      expect(run(false).root.classList.add).toHaveBeenCalledWith("js-motion");
      const reduced = run(true);
      expect(reduced.root.classList.add).not.toHaveBeenCalled();
      expect(reduced.addEventListener).not.toHaveBeenCalled();
    });

    it("drops js-motion on DOMContentLoaded unless landing.js took over", () => {
      for (const [motion, expected] of [[undefined, false], ["on", true]] as const) {
        const { root, classes, addEventListener } = run(false);
        expect(addEventListener).toHaveBeenCalledWith("DOMContentLoaded", expect.any(Function));
        if (motion) root.dataset.motion = motion;
        addEventListener.mock.calls[0][1]();
        expect(classes.has("js-motion")).toBe(expected);
      }
    });
  });

  describe("landing.js", () => {
    const run = (win: object, querySelectorAll: (sel?: string) => unknown[] = () => []) => {
      const classes = new Set(["js-motion"]);
      const root = {
        dataset: {} as Record<string, string>,
        classList: { contains: (c: string) => classes.has(c), remove: (c: string) => classes.delete(c) },
      };
      const document = { documentElement: root, querySelectorAll, getElementById: () => null };
      new Function("window", "document", readFileSync(join(__dirname, "..", "site", "landing.js"), "utf8"))(win, document);
      return { root, classes };
    };

    it("removes js-motion when Motion did not load", () => {
      expect(run({}).classes.has("js-motion")).toBe(false);
    });

    it("removes js-motion when init throws", () => {
      const boom = () => {
        throw new Error("boom");
      };
      const { classes, root } = run({ Motion: {} }, boom);
      expect(classes.has("js-motion")).toBe(false);
      expect(root.dataset.motion).toBeUndefined();
    });

    it("brings sections in with explicit y keyframes, never transform:none (Motion turns it into a zero-scale matrix)", () => {
      const animate = jest.fn();
      const section = {};
      const inView = jest.fn((_el: unknown, onEnter: () => void) => onEnter());
      run({ Motion: { animate, inView } }, () => [section]);
      expect(animate).toHaveBeenCalledWith(section, { opacity: [0, 1], y: [16, 0] }, expect.any(Object));
      for (const [, keyframes] of animate.mock.calls) expect(keyframes).not.toHaveProperty("transform");
    });

    it("watches sections with amount \"some\", not a numeric fraction that tall stacked sections never reach on a short viewport", () => {
      const inView = jest.fn();
      run({ Motion: { animate: jest.fn(), inView } }, () => [{}]);
      expect(inView).toHaveBeenCalledTimes(1);
      const options = inView.mock.calls[0][2];
      expect(options.amount).toBe("some");
      expect(options.margin).toBe("0px 0px -10% 0px");
    });

    describe("hero video", () => {
      const fakeVideo = () => ({ removeAttribute: jest.fn(), pause: jest.fn(), load: jest.fn() });
      const withVideo = (video: unknown) => (sel?: string) => (sel === ".hero-video" ? [video] : []);

      it("goes back to the poster with reduced motion", () => {
        const video = fakeVideo();
        run({ matchMedia: () => ({ matches: true }) }, withVideo(video));
        expect(video.removeAttribute).toHaveBeenCalledWith("autoplay");
        expect(video.pause).toHaveBeenCalled();
        expect(video.load).toHaveBeenCalled();
      });

      it("leaves the video alone without reduced motion", () => {
        const video = fakeVideo();
        run({ matchMedia: () => ({ matches: false }) }, withVideo(video));
        expect(video.pause).not.toHaveBeenCalled();
        expect(video.load).not.toHaveBeenCalled();
      });

      it("does not throw without matchMedia", () => {
        const video = fakeVideo();
        expect(() => run({}, withVideo(video))).not.toThrow();
        expect(video.pause).not.toHaveBeenCalled();
      });
    });

    it("marks motion as on when init succeeds", () => {
      const { classes, root } = run({ Motion: {} });
      expect(root.dataset.motion).toBe("on");
      expect(classes.has("js-motion")).toBe(true);
    });
  });
});

describe("the Open Graph image", () => {
  it("is a 1200x630 PNG", () => {
    const png = readFileSync(join(dist, "og.png"));
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});

describe("the home description", () => {
  it("is the ≤160-char version in the meta and og tags", () => {
    const html = read("index.html");
    const copy = "Un rollo de fotos compartido con tus amigos para el viaje, el casamiento o la última semana de facu. Nadie las ve hasta el revelado.";
    expect(copy.length).toBeLessThanOrEqual(160);
    expect(html).toContain(`<meta name="description" content="${copy}">`);
    expect(html).toContain(`<meta property="og:description" content="${copy}">`);
  });
});

describe("the desktop QR", () => {
  it("renders one QR for the TestFlight URL in the hero only, hidden unless wide and pointer-fine", () => {
    const html = read("index.html");
    expect(html.match(/class="qr"/g)).toHaveLength(1);
    const block = html.match(/<div class="qr"[\s\S]*?<\/div>/)![0];
    expect(block).toContain(`data-url="${TESTFLIGHT}"`);
    expect(block).toMatch(/<svg[^>]*aria-hidden="true"[\s\S]*currentColor/);
    expect(block).toContain("Escaneá con tu iPhone");
    expect(html.match(/<section[^>]*id="inicio"[\s\S]*?<\/section>/)![0]).toContain('class="qr"');
    const style = html.match(/<style>([\s\S]*?)<\/style>/)![1]!;
    expect(style).toMatch(/(^|[}\s])\.qr\{display:none\}/);
    expect(style).toMatch(/@media \(min-width:768px\) and \(hover:hover\) and \(pointer:fine\)\{[^@]*\.qr\{display:flex/);
  });
});

describe("the Smart App Banner", () => {
  const homeModule = join(__dirname, "..", "site", "home.mjs");
  const head = (storeMode: string) =>
    (
      JSON.parse(
        execFileSync(process.execPath, [
          "--input-type=module",
          "-e",
          `import { homeHtml } from ${JSON.stringify(homeModule)};
           process.stdout.write(JSON.stringify(homeHtml({ storeMode: ${JSON.stringify(storeMode)}, testflightUrl: "${TESTFLIGHT}",
             appStoreUrl: "https://apps.apple.com/app/id6825843502", siteUrl: "${SITE}" })));`,
        ]).toString(),
      ) as { head: string }
    ).head;

  it("is added in App Store mode only", () => {
    expect(head("appstore")).toContain('<meta name="apple-itunes-app" content="app-id=6825843502">');
    expect(head("beta")).not.toContain("apple-itunes-app");
    expect(read("index.html")).not.toContain("apple-itunes-app");
  });
});

describe("Cloudflare Web Analytics", () => {
  const build = (token?: string) => {
    const out = mkdtempSync(join(tmpdir(), "rollo-analytics-"));
    execFileSync(process.execPath, [join(__dirname, "..", "build-site.mjs")], {
      env: { ...process.env, SITE_DIST: out, ...(token ? { SITE_CF_ANALYTICS_TOKEN: token } : { SITE_CF_ANALYTICS_TOKEN: "" }) },
    });
    return out;
  };
  const pages = ["index.html", "soporte/index.html", "privacidad/index.html", "terminos/index.html", "friends/index.html", "entrar/index.html"];

  it("adds no beacon without a token", () => {
    for (const page of pages) expect(read(page)).not.toContain("cloudflareinsights");
  });

  it("adds the beacon to every page but /entrar when a token is set, widening only the friends CSP", () => {
    const out = build("tok123");
    try {
      const get = (page: string) => readFileSync(join(out, page), "utf8");
      const tag = `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"tok123"}'></script>`;
      for (const page of pages.slice(0, 5)) expect(get(page)).toContain(tag);
      expect(get("entrar/index.html")).not.toContain("cloudflareinsights");
      expect(get("entrar/index.html")).toContain("connect-src 'none'");
      const csp = get("friends/index.html").match(/Content-Security-Policy" content="([^"]+)"/)![1]!;
      expect(csp).toContain("https://static.cloudflareinsights.com");
      expect(csp).toContain("connect-src https://cloudflareinsights.com");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
