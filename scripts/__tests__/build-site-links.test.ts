/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let dist: string;
let html: string;

beforeAll(() => {
  dist = mkdtempSync(join(tmpdir(), "rollo-site-links-"));
  execFileSync(process.execPath, [join(__dirname, "..", "build-site.mjs")], { env: { ...process.env, SITE_DIST: dist, SITE_CF_ANALYTICS_TOKEN: "" } });
  html = readFileSync(join(dist, "friends", "index.html"), "utf8");
});
afterAll(() => rmSync(dist, { recursive: true, force: true }));

describe("Universal Links files", () => {
  it("serves the apple-app-site-association for the production app only", () => {
    const file = join(dist, ".well-known", "apple-app-site-association");
    expect(existsSync(file)).toBe(true);
    const aasa = JSON.parse(readFileSync(file, "utf8"));
    expect(aasa.applinks.details).toHaveLength(1);
    const detail = aasa.applinks.details[0];
    expect(detail.appIDs).toEqual(["UXHNAR4HYC.com.juanifraga.rollo.app"]);
    expect(detail.components.map((c: { "/": string }) => c["/"])).toEqual(["/entrar", "/entrar/", "/friends", "/friends/"]);
    for (const c of detail.components) expect(c["#"]).toBeUndefined(); // fragments allowed
  });

  it("sets application/json on the association file through _headers", () => {
    const headers = readFileSync(join(dist, "_headers"), "utf8");
    expect(headers).toMatch(/^\/\.well-known\/apple-app-site-association\n[ \t]+Content-Type: application\/json$/m);
  });
});

const inlineScript = () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  expect(scripts).toHaveLength(1);
  return scripts[0]!;
};

/** Runs the page's script against a fake browser opened at `/friends<hash>`. */
function open(hash: string) {
  const elements: { [id in "ok" | "bad" | "open" | "code"]: { hidden: boolean; href?: string; textContent?: string } } = {
    ok: { hidden: true },
    bad: { hidden: true },
    open: { hidden: false, href: "#" },
    code: { hidden: false, textContent: "" },
  };
  const location = { hash, pathname: "/friends", search: "", href: `https://rollo.juanifraga.com/friends${hash}` };
  const history = { replaceState: jest.fn() };
  const document = { getElementById: (id: keyof typeof elements) => elements[id] };
  new Function("location", "history", "document", inlineScript())(location, history, document);
  return { location, history, elements };
}

describe("the /friends page (friend link fallback)", () => {
  it("shows the code and an Abrir Rollo button pointing at the deep link, without redirecting", () => {
    const { location, elements, history } = open("#K7M2QX9A");
    expect(elements.open.href).toBe("rollo://friends/K7M2QX9A");
    expect(elements.code.textContent).toBe("K7M2QX9A");
    expect(elements.ok.hidden).toBe(false);
    expect(elements.bad.hidden).toBe(true);
    expect(location.href).toBe("https://rollo.juanifraga.com/friends#K7M2QX9A");
    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it("uppercases a lowercase code", () => {
    const { elements } = open("#k7m2qx9a");
    expect(elements.open.href).toBe("rollo://friends/K7M2QX9A");
    expect(elements.code.textContent).toBe("K7M2QX9A");
  });

  it.each(["", "#", "#bad", "#K7M2QX9A&x=1", "#K7M2QX9", "#K7M2QX9AB", "#K7M2-X9A"])("rejects %p", (hash) => {
    const { elements } = open(hash);
    expect(elements.bad.hidden).toBe(false);
    expect(elements.ok.hidden).toBe(true);
    expect(elements.open.href).toBe("#");
  });

  it("has the copy and the store link", () => {
    expect(html).toContain("Te invitaron a Rollo");
    expect(html).toContain("Abr&iacute; el link en el iPhone donde ten&eacute;s Rollo.");
    expect(html).toContain("Este link no es v&aacute;lido. Pedile a tu amigo que te mande uno nuevo.");
    expect(html).toContain("&iquest;Te invit&oacute; un amigo?");
    expect(html).toContain('href="https://testflight.apple.com/join/Q557gZkR"');
    expect(html.match(/<noscript>[\s\S]*Pedile a tu amigo[\s\S]*<\/noscript>/)).not.toBeNull();
  });

  it("loads no motion script nor motion class", () => {
    for (const needle of ["motion.js", "landing.js", "js-motion"]) expect(html).not.toContain(needle);
  });

  it("is locked down: CSP hash matches its script, no network, no referrer, noindex", () => {
    const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1];
    expect(csp).toBeDefined();
    const hash = createHash("sha256").update(inlineScript()).digest("base64");
    expect(csp).toContain(`script-src 'sha256-${hash}'`);
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("default-src 'none'");
    expect(html).toContain('<meta name="referrer" content="no-referrer">');
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).not.toMatch(/<script[^>]+src=/);
  });
});
