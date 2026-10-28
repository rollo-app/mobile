/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let dist: string;
let html: string;

beforeAll(() => {
  dist = mkdtempSync(join(tmpdir(), "rollo-site-"));
  execFileSync(process.execPath, [join(__dirname, "..", "build-site.mjs")], { env: { ...process.env, SITE_DIST: dist } });
  html = readFileSync(join(dist, "entrar", "index.html"), "utf8");
});
afterAll(() => rmSync(dist, { recursive: true, force: true }));

it("the /entrar page loads no motion script nor motion class", () => {
  for (const needle of ["motion.js", "landing.js", "js-motion"]) expect(html).not.toContain(needle);
});

const inlineScript = () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  expect(scripts).toHaveLength(1);
  return scripts[0]!;
};

/** Runs the page's script against a fake browser opened at `/entrar<hash>`. */
function open(hash: string) {
  const elements: { [id in "ok" | "bad" | "open"]: { hidden: boolean; href?: string } } = {
    ok: { hidden: true },
    bad: { hidden: true },
    open: { hidden: false, href: "#" },
  };
  const location = { hash, pathname: "/entrar", search: "", href: `https://rollo.juanifraga.com/entrar${hash}` };
  const history = { replaceState: jest.fn() };
  const document = { getElementById: (id: keyof typeof elements) => elements[id] };
  new Function("location", "history", "document", inlineScript())(location, history, document);
  return { location, history, elements };
}

describe("the /entrar page (magic link from the email)", () => {
  it("opens the app with the token and the email from the fragment, encoded", () => {
    const { location, elements } = open("#t=abc%2Bdef&e=juani%2Bviaje%40rollo.test");

    const deepLink = "rollo://login?token=abc%2Bdef&email=juani%2Bviaje%40rollo.test";
    expect(location.href).toBe(deepLink);
    expect(elements.open.href).toBe(deepLink);
    expect(elements.ok.hidden).toBe(false);
    expect(elements.bad.hidden).toBe(true);
  });

  it("clears the token from the address bar", () => {
    const { history } = open("#t=abc&e=a%40b.c");
    expect(history.replaceState).toHaveBeenCalledWith(null, "", "/entrar");
  });

  it("without a token it says the link isn't valid and opens nothing", () => {
    const { location, elements } = open("");
    expect(location.href).toBe("https://rollo.juanifraga.com/entrar");
    expect(elements.bad.hidden).toBe(false);
    expect(elements.ok.hidden).toBe(true);
  });

  it("has the button and the copy", () => {
    expect(html).toContain('id="open"');
    expect(html).toContain("Abrir Rollo");
    expect(html).toContain("Si la app no se abri&oacute;, toc&aacute; el bot&oacute;n.");
    expect(html).toContain("Este link no es v&aacute;lido. Ped&iacute; un c&oacute;digo nuevo desde la app.");
  });

  it("sends nothing anywhere: no network calls, no external resources", () => {
    const script = inlineScript();
    for (const call of ["fetch", "XMLHttpRequest", "sendBeacon", "WebSocket", "Image", "import("]) expect(script).not.toContain(call);
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<(img|iframe)\b/);
    expect(html).not.toMatch(/(src|href)="(https?:)?\/\//);
    expect(html).toContain('<meta name="referrer" content="no-referrer">');
  });

  it("locks the page down with a CSP: only its own inline script runs and it can't connect anywhere", () => {
    const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1];
    expect(csp).toBeDefined();
    const hash = createHash("sha256").update(inlineScript()).digest("base64");
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain(`script-src 'sha256-${hash}'`);
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("base-uri 'none'");
  });
});
