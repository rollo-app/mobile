// The home (landing): hero with the video, two feature sections (map, reveal) and the closing, plus its own wide stylesheet.
import { tokensCss } from "./tokens.mjs";

const IPHONE_ONLY = "Solo para iPhone · Gratis";

/** Hero: the rendered loop inside the phone frame (the video is decorative; the figure carries the label). */
const heroVideo = () =>
  `<div class="phone"><video class="hero-video" muted autoplay loop playsinline preload="metadata" poster="/hero-poster.jpg" aria-hidden="true"><source src="/hero.webm" type="video/webm"><source src="/hero.mp4" type="video/mp4"></video></div>`;

/** A still of the app inside the phone frame (decorative; the figure carries the label). */
const stillPhone = (src) =>
  `<div class="phone"><img class="shot-img" src="${src}" alt="" loading="lazy" decoding="async" width="540" height="1170"></div>`;

const shot = (id, label, phone) =>
  `<figure class="figure" aria-label="${label}"><div class="shot" data-shot="${id}">${phone}</div></figure>`;

const cta = ({ storeMode, testflightUrl, appStoreUrl }) =>
  `<div class="cta">
${
  storeMode === "appstore"
    ? `<a class="store" href="${appStoreUrl}"><img src="/app-store-badge.svg" alt="Descargar en el App Store" width="156" height="52"></a>`
    : `<a class="btn" href="${testflightUrl}">Probar la beta en iPhone</a>`
}
<p class="note">${IPHONE_ONLY}</p>
</div>`;

/** Enables the scroll animations unless the visitor asked for reduced motion; drops it again if landing.js did not take over (fires after deferred scripts). Runs with `document` and `matchMedia` in scope. */
const HEAD_SCRIPT = `if(!matchMedia("(prefers-reduced-motion: reduce)").matches){var h=document.documentElement;h.classList.add("js-motion");document.addEventListener("DOMContentLoaded",function(){if(h.dataset.motion!=="on")h.classList.remove("js-motion")})}`;

/**
 * @param {{ storeMode: "beta" | "appstore", testflightUrl: string, appStoreUrl: string | null, siteUrl: string }} opts
 * @returns {{ head: string, body: string }}
 */
export function homeHtml({ storeMode, testflightUrl, appStoreUrl, siteUrl }) {
  const button = cta({ storeMode, testflightUrl, appStoreUrl });
  const description =
    "Un rollo compartido para tu próximo viaje con amigos. Nadie ve las fotos hasta el revelado. Solo para iPhone.";

  const head = [
    `<link rel="canonical" href="${siteUrl}/">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${siteUrl}/">`,
    `<meta property="og:title" content="Rollo · Sacá la foto. Mirala después.">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:image" content="${siteUrl}/og.png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="theme-color" media="(prefers-color-scheme: light)" content="#F2F0EB">`,
    `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0E0F14">`,
    `<script>${HEAD_SCRIPT}</script>`,
    `<script src="/motion.js" defer></script>`,
    `<script src="/landing.js" defer></script>`,
    "",
  ].join("\n");

  const body = `<section id="inicio" class="hero">
<div class="text">
<h1 class="serif">Sacá la foto.<br>Mirala después.</h1>
<p class="lead">Un rollo compartido para viajar con amigos. Cada uno saca sus fotos y nadie las ve hasta el revelado.</p>
${button}
</div>
${shot("inicio", "La app en uso: sacás la foto, el mapa del grupo, el revelado y tu perfil", heroVideo())}
</section>

<section id="mapa" class="feature" data-enter>
<div class="text">
<h2 class="serif">Ves dónde sacan, no qué sacan.</h2>
<p>Mientras dura el rollo, el mapa se llena con los pins del grupo: quién sacó, dónde y a qué hora. Las fotos siguen ocultas. Sin señal, se guardan y se suben solas cuando vuelve.</p>
</div>
${shot("mapa", "El mapa del rollo con los pins del grupo en Budapest", stillPhone("/map.jpg"))}
</section>

<section id="revelado" class="feature" data-enter>
<div class="text">
<h2 class="serif">Todas juntas, al final del viaje.</h2>
<p>Cuando termina el rollo se revelan las fotos de todos a la vez, y ahí descubrís cómo lo vivió cada uno. Una vez por día, el momento te avisa para sacar una foto con las dos cámaras. Las mejores van a tu perfil.</p>
</div>
${shot("revelado", "El revelado del rollo Europa", stillPhone("/reveal.jpg"))}
</section>

<section id="cierre" data-enter>
<div class="text">
<h2 class="serif">Estrenalo en tu próximo viaje.</h2>
<p>Tus fotos solo las ven las personas de tu rollo.</p>
${button}
<p class="help">¿Tenés dudas? <a id="soporte" href="/soporte">Soporte y preguntas frecuentes</a></p>
</div>
</section>`;

  return { head, body };
}

export const homeCss = `
.js-motion [data-enter]{opacity:0;transform:translateY(16px)}
${tokensCss}
:root{--screen:#F7F6F2;--bezel:#111;--gutter:20px;--s-text:16px;--s-cta:24px;--s-figure:32px;--s-section:80px}
@media (prefers-color-scheme:dark){:root{--bezel:#2a2c35}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.55 -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif}
.wrap.wide{max-width:1040px;margin:0 auto;padding:20px var(--gutter) 40px}
a{color:var(--tint)}
a:focus-visible{outline:3px solid var(--tint);outline-offset:3px;border-radius:4px}
.serif{font-family:ui-serif,"New York",Georgia,serif;font-weight:500}
header.top{margin-bottom:var(--s-figure)}
header.top a{display:inline-flex;align-items:center;gap:10px;color:var(--fg);text-decoration:none;font-weight:600;font-size:19px}
.logo{color:var(--tint);flex:none}
h1,h2,p,figure{margin:0}
h1,h2{text-wrap:balance}
h1{font-size:clamp(40px,11vw,64px);line-height:1.04;letter-spacing:-.01em;margin-bottom:var(--s-text)}
h2{font-size:clamp(28px,7vw,38px);line-height:1.15;margin-bottom:var(--s-text)}
.text p{color:var(--muted)}
.lead{font-size:19px;max-width:30em}
section{margin-top:var(--s-section)}
section.hero{margin-top:0}
.cta{margin-top:var(--s-cta);display:flex;flex-direction:column;align-items:flex-start;gap:var(--s-text)}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:12px 28px;background:var(--tint);color:#fff;text-decoration:none;font-weight:700;font-size:20px;border-radius:999px}
.store{display:inline-block;line-height:0}
.store img{display:block}
.note{font-size:15px;color:var(--muted)}
.help{margin-top:var(--s-cta)}
.figure{display:flex;justify-content:flex-start;margin-top:var(--s-figure)}
.phone{width:min(74vw,280px);aspect-ratio:9/19.5;border-radius:40px;background:var(--bezel);padding:9px;box-shadow:0 24px 48px rgba(0,0,0,.16)}
.hero-video,.shot-img{width:100%;height:100%;object-fit:cover;border-radius:31px;display:block}
footer{margin-top:var(--s-section);padding-top:16px;border-top:1px solid var(--rule);color:var(--muted);font-size:14px}
footer p{margin:0 0 6px}
footer a{color:var(--muted)}
@media (min-width:768px){
  .wrap.wide{padding:28px 32px 48px}
  h1{font-size:clamp(44px,6vw,64px)}
  .hero,.feature{display:grid;grid-template-columns:1.15fr .85fr;gap:56px;align-items:center}
  .figure{justify-content:center;margin-top:0}
  .phone{width:270px}
  .feature .text{max-width:30em}
}
`;
