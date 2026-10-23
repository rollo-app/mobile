/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
