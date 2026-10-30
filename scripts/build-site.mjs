// Builds the static public site (home, support and legal pages) into site/dist.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import QRCode from "qrcode";
import { marked } from "marked";
import { homeCss, homeHtml } from "./site/home.mjs";
import { tokensCss } from "./site/tokens.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = process.env.SITE_DIST ?? join(root, "site", "dist");

const SITE_URL = "https://rollo.juanifraga.com";
// Switch after Apple approves the app: change the default "beta" -> "appstore", set APP_STORE_URL and add the official badge file
// (scripts/site/app-store-badge.svg). The deploy does not set SITE_STORE_MODE, so this default is what ships.
/** @type {"beta" | "appstore"} */
const STORE_MODE = process.env.SITE_STORE_MODE ?? "beta";
const TESTFLIGHT_URL = "https://testflight.apple.com/join/Q557gZkR";
const APP_STORE_URL = null; // filled in when the app is approved
// Cloudflare Web Analytics (cookieless, page views only); public token from the Web Analytics site. SITE_CF_ANALYTICS_TOKEN=""
// builds without it (the tests do). Never added to /entrar (strict CSP, no third-party requests).
const CF_ANALYTICS_TOKEN = (process.env.SITE_CF_ANALYTICS_TOKEN ?? "773f8a15b710464095838f919b7389d8") || null;
const APP_STORE_BADGE = process.env.SITE_APP_STORE_BADGE ?? join(root, "scripts", "site", "app-store-badge.svg");

if (STORE_MODE !== "beta" && STORE_MODE !== "appstore") throw new Error(`Unknown SITE_STORE_MODE: ${STORE_MODE}`);
if (STORE_MODE === "appstore") {
  if (!existsSync(APP_STORE_BADGE)) {
    throw new Error("Missing scripts/site/app-store-badge.svg (official Apple badge) for STORE_MODE=appstore");
  }
  if (!APP_STORE_URL) throw new Error("Missing APP_STORE_URL for STORE_MODE=appstore");
}

const logo = (size) => `<svg class="logo" width="${size}" height="${size}" viewBox="14 14 76 76" aria-hidden="true">
<circle cx="60" cy="60" r="34" fill="currentColor" fill-opacity="0.18"/>
<circle cx="66" cy="54" r="24" fill="currentColor" fill-opacity="0.38"/>
<circle cx="71" cy="49" r="14" fill="currentColor"/></svg>`;

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<rect width="120" height="120" rx="26" fill="#F2F0EB"/>
<circle cx="60" cy="60" r="34" fill="#3155F5" fill-opacity="0.18"/>
<circle cx="66" cy="54" r="24" fill="#3155F5" fill-opacity="0.38"/>
<circle cx="71" cy="49" r="14" fill="#3155F5"/></svg>`;

const css = `
${tokensCss}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.6 -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif}
.wrap{max-width:680px;margin:0 auto;padding:24px 16px 48px}
a{color:var(--tint)}
header.top{margin-bottom:32px}
header.top a{display:inline-flex;align-items:center;gap:10px;color:var(--fg);text-decoration:none;font-weight:600;font-size:19px}
.logo{color:var(--tint);flex:none}
h1{font-size:28px;line-height:1.2;margin:0 0 16px}
h2{font-size:21px;line-height:1.3;margin:36px 0 8px}
h3{font-size:17px;margin:24px 0 4px}
p,ul,ol{margin:0 0 14px}
li{margin-bottom:6px}
hr{border:0;border-top:1px solid var(--rule);margin:28px 0}
.tagline{font-family:ui-serif,"New York",Georgia,serif;font-size:22px;line-height:1.35;margin:0 0 8px}
.brand{display:flex;align-items:center;gap:14px;margin:8px 0 20px}
.brand h1{margin:0;font-size:34px}
.faq h3{font-weight:600}
footer{margin-top:48px;padding-top:16px;border-top:1px solid var(--rule);color:var(--muted);font-size:14px}
footer a{color:var(--muted)}
table{border-collapse:collapse;display:block;overflow-x:auto;max-width:100%;margin:0 0 14px}
th,td{border-bottom:1px solid var(--rule);padding:6px 10px 6px 0;text-align:left;vertical-align:top}
code{font-family:ui-monospace,Menlo,monospace;font-size:15px}
.btn{display:block;text-align:center;background:var(--tint);color:#fff;text-decoration:none;font-weight:600;font-size:19px;padding:16px 24px;border-radius:999px;margin:24px 0 16px}
.muted{color:var(--muted)}
`;

const footer = `<footer><p>&copy; 2026 Juan Ignacio Fraga &middot; Uruguay</p>
<p><a href="/privacidad">Privacidad</a> &middot; <a href="/terminos">T&eacute;rminos</a> &middot; <a href="/soporte">Soporte</a></p></footer>`;

const beacon = CF_ANALYTICS_TOKEN
  ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token: CF_ANALYTICS_TOKEN })}'></script>\n`
  : "";

// Inline SVG QR for the store link: dark modules in currentColor (adapts to light/dark), 4-module quiet zone.
const qrSvg = (url) => {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = modules.size;
  const quiet = 4;
  let d = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (modules.get(x, y)) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
  const size = n + quiet * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="112" height="112" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
};

const page = ({ title, description, body, header = true, head = "", css: styles = css, wide = false, analytics = true }) => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${styles}</style>
${head}</head>
<body>
<div class="wrap${wide ? " wide" : ""}">
${header ? `<header class="top"><a href="/">${logo(28)}<span>Rollo</span></a></header>` : ""}
<main>
${body}
</main>
${footer}
</div>
${analytics ? beacon : ""}</body>
</html>
`;

const write = (path, content) => {
  const file = join(dist, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
};

const legal = (name) =>
  marked
    .parse(readFileSync(join(root, "docs", "legal", `${name}.md`), "utf8"))
    .replaceAll('href="privacidad.md"', 'href="/privacidad"')
    .replaceAll('href="terminos.md"', 'href="/terminos"');

const home = homeHtml({
  storeMode: STORE_MODE,
  testflightUrl: TESTFLIGHT_URL,
  appStoreUrl: APP_STORE_URL,
  siteUrl: SITE_URL,
  qr: { svg: qrSvg(STORE_MODE === "appstore" ? APP_STORE_URL : TESTFLIGHT_URL), url: STORE_MODE === "appstore" ? APP_STORE_URL : TESTFLIGHT_URL },
});
write("index.html", page({
  title: "Rollo · Fotos en grupo para iPhone",
  description: "Un rollo de fotos compartido con tus amigos para el viaje, el casamiento o la última semana de facu. Nadie las ve hasta el revelado.",
  body: home.body,
  head: home.head,
  css: homeCss,
  wide: true,
}));
await build({
  entryPoints: [join(root, "scripts", "site", "motion-entry.mjs")],
  bundle: true,
  minify: true,
  format: "iife",
  globalName: "Motion",
  outfile: join(dist, "motion.js"),
});
copyFileSync(join(root, "scripts", "site", "landing.js"), join(dist, "landing.js"));
if (STORE_MODE === "appstore") copyFileSync(APP_STORE_BADGE, join(dist, "app-store-badge.svg"));
const HERO_DIR = process.env.SITE_HERO_DIR ?? join(root, "scripts", "site");
for (const name of ["hero.mp4", "hero.webm", "hero-poster.jpg", "map.jpg", "reveal.jpg"]) {
  if (!existsSync(join(HERO_DIR, name))) {
    throw new Error(`Missing ${name} in ${HERO_DIR}: render the hero video with \`npm run render\` (in video/)`);
  }
  copyFileSync(join(HERO_DIR, name), join(dist, name));
}
copyFileSync(join(root, "scripts", "site", "og.png"), join(dist, "og.png"));
const soporte = `<h2>Soporte</h2>
<p>Escribinos a <a href="mailto:soporte@juanifraga.com">soporte@juanifraga.com</a> y te respondemos.</p>
<div class="faq">
<h3>&iquest;C&oacute;mo me sumo a un rollo?</h3>
<p>Con el c&oacute;digo de 6 caracteres que te pasa alguien del rollo. Lo ingres&aacute;s en la app y listo.</p>
<h3>&iquest;C&oacute;mo borro mi cuenta?</h3>
<p>Desde Perfil &rarr; Ajustes &rarr; Borrar cuenta. Es definitivo: se borran tus fotos y videos de todos los rollos, tu membres&iacute;a, tus amistades, tu foto de perfil y tu email. Los detalles est&aacute;n en la <a href="/privacidad">pol&iacute;tica de privacidad</a>.</p>
<h3>&iquest;C&oacute;mo denuncio una foto o bloqueo a alguien?</h3>
<p>Desde la app, en la foto o en el perfil de la persona. Tambi&eacute;n nos pod&eacute;s escribir a <a href="mailto:soporte@juanifraga.com">soporte@juanifraga.com</a>.</p>
<h3>&iquest;Hay versi&oacute;n para Android?</h3>
<p>Por ahora Rollo es solo para iPhone.</p>
</div>`;

write("soporte/index.html", page({
  title: "Soporte · Rollo",
  description: "Soporte de Rollo: preguntas frecuentes y contacto.",
  body: soporte,
}));
write("privacidad/index.html", page({
  title: "Política de privacidad · Rollo",
  description: "Política de privacidad de Rollo.",
  body: legal("privacidad"),
}));
write("terminos/index.html", page({
  title: "Términos de uso · Rollo",
  description: "Términos de uso de Rollo.",
  body: legal("terminos"),
}));
// The login email's button: https://rollo.juanifraga.com/entrar#t=<token>&e=<email>. The fragment never reaches
// any server; this page only hands it to the app (rollo://login) and wipes it from the address bar.
const entrarScript = `(function () {
  var params = new URLSearchParams(location.hash.slice(1));
  var token = params.get("t");
  var email = params.get("e");
  history.replaceState(null, "", location.pathname + location.search);
  if (!token || !email) {
    document.getElementById("bad").hidden = false;
    return;
  }
  var deepLink = "rollo://login?token=" + encodeURIComponent(token) + "&email=" + encodeURIComponent(email);
  document.getElementById("open").href = deepLink;
  document.getElementById("ok").hidden = false;
  location.href = deepLink;
})();`;

const entrar = `<h1>Entrar a Rollo</h1>
<div id="ok" hidden>
<a id="open" class="btn" href="#">Abrir Rollo</a>
<p class="muted">Si la app no se abri&oacute;, toc&aacute; el bot&oacute;n. Ten&eacute;s que abrirlo en el iPhone donde est&aacute; Rollo.</p>
</div>
<div id="bad" hidden>
<p>Este link no es v&aacute;lido. Ped&iacute; un c&oacute;digo nuevo desde la app.</p>
</div>
<noscript><p>Este link no es v&aacute;lido. Ped&iacute; un c&oacute;digo nuevo desde la app.</p></noscript>
<script>${entrarScript}</script>`;

write("entrar/index.html", page({
  title: "Entrar · Rollo",
  description: "Entrá a Rollo con el link del mail.",
  body: entrar,
  analytics: false,
  head: [
    // Only this page's own script runs and nothing can be fetched or sent: the token never leaves the phone.
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${createHash("sha256").update(entrarScript).digest("base64")}'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'">`,
    `<meta name="referrer" content="no-referrer">`,
    `<meta name="robots" content="noindex">`,
    "",
  ].join("\n"),
}));
// Friend link: https://rollo.juanifraga.com/friends#<CODE>. With the app installed (production build) iOS opens it
// through Universal Links and this page is never shown; it is the fallback for people without the app, old builds
// and computers. No auto-redirect (Safari errors if the app is missing) and the fragment stays: the code isn't secret.
const friendsScript = `(function () {
  var match = /^#([A-Za-z0-9]{8})$/.exec(location.hash);
  if (!match) {
    document.getElementById("bad").hidden = false;
    return;
  }
  var code = match[1].toUpperCase();
  document.getElementById("code").textContent = code;
  document.getElementById("open").href = "rollo://friends/" + code;
  document.getElementById("ok").hidden = false;
})();`;

const storeHref = STORE_MODE === "appstore" ? APP_STORE_URL : TESTFLIGHT_URL;
const friendsInvalid = `<p>Este link no es v&aacute;lido. Pedile a tu amigo que te mande uno nuevo.</p>`;
const friends = `<h1>Te invitaron a Rollo</h1>
<div id="ok" hidden>
<p>Abr&iacute; el link en el iPhone donde ten&eacute;s Rollo.</p>
<a id="open" class="btn" href="#">Abrir Rollo</a>
<p class="muted">&iquest;Todav&iacute;a no ten&eacute;s Rollo? <a href="${storeHref}">Bajala ac&aacute;</a>. Cuando armes tu perfil, escrib&iacute; este c&oacute;digo en &laquo;&iquest;Te invit&oacute; un amigo?&raquo;: <strong id="code"></strong>. Vale una hora.</p>
</div>
<div id="bad" hidden>
${friendsInvalid}
<p class="muted"><a href="${storeHref}">Bajar Rollo</a></p>
</div>
<noscript>${friendsInvalid}<p class="muted"><a href="${storeHref}">Bajar Rollo</a></p></noscript>
<script>${friendsScript}</script>`;

write("friends/index.html", page({
  title: "Sumate a Rollo · Rollo",
  description: "Te invitaron a ser amigos en Rollo.",
  body: friends,
  head: [
    // With the analytics beacon (this page only, not /entrar) the CSP also allows Cloudflare's script and its report endpoint.
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${createHash("sha256").update(friendsScript).digest("base64")}'${CF_ANALYTICS_TOKEN ? " https://static.cloudflareinsights.com" : ""}; style-src 'unsafe-inline'; img-src 'self'; connect-src ${CF_ANALYTICS_TOKEN ? "https://cloudflareinsights.com" : "'none'"}; form-action 'none'; base-uri 'none'">`,
    `<meta name="referrer" content="no-referrer">`,
    `<meta name="robots" content="noindex">`,
    "",
  ].join("\n"),
}));
// Universal Links: only the production app (team + bundle id). Fragments are allowed by default.
write(".well-known/apple-app-site-association", JSON.stringify({
  applinks: {
    details: [{
      appIDs: ["UXHNAR4HYC.com.juanifraga.rollo.app"],
      components: [
        { "/": "/entrar", comment: "Magic link from the login email" },
        { "/": "/entrar/" },
        { "/": "/friends", comment: "Friend link" },
        { "/": "/friends/" },
      ],
    }],
  },
}, null, 2) + "\n");
// Cloudflare Workers Static Assets: the extensionless AASA file must be served as JSON.
write("_headers", "/.well-known/apple-app-site-association\n  Content-Type: application/json\n");
write("404.html", page({
  title: "No encontrada · Rollo",
  description: "Esta página no existe.",
  body: `<h1>No encontramos esa p&aacute;gina</h1><p><a href="/">Volver al inicio</a></p>`,
}));
write("favicon.svg", favicon);
console.log("site built in site/dist");
