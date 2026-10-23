// Builds the static public site (home/support + legal pages) into site/dist.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = process.env.SITE_DIST ?? join(root, "site", "dist");

const SITE_URL = "https://rollo.juanifraga.com";
/** @type {"beta" | "appstore"} */
const STORE_MODE = process.env.SITE_STORE_MODE ?? "beta";
const TESTFLIGHT_URL = "https://testflight.apple.com/join/Q557gZkR";
const APP_STORE_URL = null; // filled in when the app is approved

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
:root{--bg:#F2F0EB;--fg:#1c1c1e;--muted:#6c6c70;--rule:#d8d5cd;--tint:#3155F5}
@media (prefers-color-scheme:dark){:root{--bg:#0E0F14;--fg:#f2f2f7;--muted:#98989f;--rule:#2a2c35;--tint:#5C7CFF}}
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

const page = ({ title, description, body, header = true, head = "" }) => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${css}</style>
${head}</head>
<body>
<div class="wrap">
${header ? `<header class="top"><a href="/">${logo(28)}<span>Rollo</span></a></header>` : ""}
<main>
${body}
</main>
${footer}
</div>
</body>
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

const home = `<div class="brand">${logo(56)}<h1>Rollo</h1></div>
<p class="tagline">Fotos en grupo que nadie ve hasta el revelado.</p>
<p>Una app para iPhone para sacar fotos y videos con tus amigos, como un rollo de fotos de los de antes.</p>

<h2>C&oacute;mo funciona</h2>
<ol>
<li>Abr&iacute;s un rollo y sum&aacute;s a tus amigos con un c&oacute;digo.</li>
<li>Cada uno saca fotos y videos, y nadie los ve, ni los propios.</li>
<li>En el revelado aparecen todas juntas, con mapa y presentaci&oacute;n.</li>
</ol>

<p><a id="soporte" href="/soporte">Soporte</a></p>`;

write("index.html", page({
  title: "Rollo",
  description: "Rollo: fotos y videos en grupo que nadie ve hasta el revelado. App para iPhone.",
  body: home,
  header: false,
}));
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
  head: [
    // Only this page's own script runs and nothing can be fetched or sent: the token never leaves the phone.
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${createHash("sha256").update(entrarScript).digest("base64")}'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'">`,
    `<meta name="referrer" content="no-referrer">`,
    `<meta name="robots" content="noindex">`,
    "",
  ].join("\n"),
}));
write("404.html", page({
  title: "No encontrada · Rollo",
  description: "Esta página no existe.",
  body: `<h1>No encontramos esa p&aacute;gina</h1><p><a href="/">Volver al inicio</a></p>`,
}));
write("favicon.svg", favicon);
console.log("site built in site/dist");
