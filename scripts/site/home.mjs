// The home (landing): 8 sections in the order a rollo is lived, plus its own wide stylesheet.
import { tokensCss } from "./tokens.mjs";

const IPHONE_ONLY = "Solo para iPhone · Gratis";

/** Empty phone frame; Task 3's mockups replace it. */
const emptyPhone = () => `<div class="phone"><div class="screen"></div></div>`;

/** Hero: the rendered loop inside the phone frame (the video is decorative; the figure carries the label). */
const heroVideo = () =>
  `<div class="phone"><video class="hero-video" muted autoplay loop playsinline preload="metadata" poster="/hero-poster.jpg" aria-hidden="true"><source src="/hero.webm" type="video/webm"><source src="/hero.mp4" type="video/mp4"></video></div>`;

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
 * @param {{ storeMode: "beta" | "appstore", testflightUrl: string, appStoreUrl: string | null, siteUrl: string,
 *   mockups?: { steps(): string[], map(): string, reveal(): string, profile(): string } }} opts
 * @returns {{ head: string, body: string }}
 */
export function homeHtml({ storeMode, testflightUrl, appStoreUrl, siteUrl, mockups }) {
  const steps = mockups?.steps() ?? [emptyPhone(), emptyPhone(), emptyPhone()];
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
    `<script src="/lottie.js" defer></script>`,
    `<script src="/landing.js" defer></script>`,
    "",
  ].join("\n");

  const body = `<section id="inicio" class="hero">
<div class="text">
<h1 class="serif">Sacá la foto.<br>Mirala después.</h1>
<p class="lead">Un rollo compartido para tu próximo viaje con amigos. Nadie ve las fotos hasta el revelado, y ahí descubrís cómo lo vivió cada uno.</p>
${button}
</div>
${shot("inicio", "La app en uso: sacás la foto, el mapa del grupo, el revelado y tu perfil", heroVideo())}
</section>

<section id="como-funciona" data-enter>
<h2 class="serif">Cómo funciona</h2>
<ol class="steps" role="list">
<li>
<h3>Abrí un rollo</h3>
<p>Ponele nombre, fechas y cuándo se revela. Tus amigos se suman con un código de 6 caracteres.</p>
${shot("como-funciona", "Unirse a un rollo con el código", steps[0])}
</li>
<li>
<h3>Sacá sin mirar</h3>
<p>Cada uno saca fotos y videos durante el rollo. Una vez que la mandás, nadie la ve, ni vos.</p>
${shot("como-funciona", "Mandar una foto al rollo", steps[1])}
</li>
<li>
<h3>Se revelan juntas</h3>
<p>Al final se revelan todas a la vez, con las de todos mezcladas.</p>
${shot("como-funciona", "El rollo revelado", steps[2])}
</li>
</ol>
</section>

<section id="mapa" class="feature" data-enter>
<div class="text">
<h2 class="serif">Mientras dura el rollo</h2>
<p>En el mapa ves quién sacó una foto y dónde, y en el feed, cuándo: “Cami sacó una foto · 14:32”. Las fotos siguen siendo manchas de color hasta el revelado.</p>
<h3>Funciona sin señal</h3>
<p>Las fotos se guardan en el celular y se suben solas cuando vuelve la señal. El mapa de la zona se baja antes, para la ruta o la montaña.</p>
</div>
${shot("mapa", "El mapa del rollo con los pins de cada uno", mockups?.map() ?? emptyPhone())}
</section>

<section id="momento" class="feature flip" data-enter>
<div class="text">
<h2 class="serif">El momento del día</h2>
<p>Una vez por día, a una hora sorpresa y distinta para cada uno, te llega el aviso: tenés 15 minutos para sacar una foto extra, aparte de tu cupo.</p>
<p>Si se te pasa, se pierde. Como esas fotos que no vuelven.</p>
</div>
<div class="figure"><div class="moment-mark">
<svg class="moment-static" viewBox="0 0 512 512" role="img" aria-label="El logo de Rollo con el anillo de los 15 minutos del momento">
<circle cx="256" cy="256" r="88" fill="var(--tint)" fill-opacity="0.18"/>
<circle cx="271.6" cy="240.4" r="62" fill="var(--tint)" fill-opacity="0.38"/>
<circle cx="284.6" cy="227.4" r="36" fill="var(--tint)"/>
<circle cx="256" cy="256" r="118" fill="none" stroke="var(--tint)" stroke-width="6" stroke-linecap="round"/>
</svg>
<div class="moment-anim" aria-hidden="true"></div>
</div></div>
</section>

<section id="revelado" class="feature" data-enter>
<div class="text">
<h2 class="serif">El revelado</h2>
<p>Cuando termina el rollo, las fotos aparecen todas juntas, como cuando ibas a buscar las copias. Ahí ves el viaje con los ojos de cada uno.</p>
<p>Después, la presentación: todo el rollo como historias, una foto atrás de otra.</p>
</div>
${shot("revelado", "Las fotos del rollo revelándose", mockups?.reveal() ?? emptyPhone())}
</section>

<section id="perfil" class="feature flip" data-enter>
<div class="text">
<h2 class="serif">Tu perfil</h2>
<p>Destacá tus fotos favoritas de rollos pasados, también las que sacaron tus amigos. En el mapa se ven por zonas, nunca el lugar exacto.</p>
</div>
${shot("perfil", "Un perfil con fotos destacadas", mockups?.profile() ?? emptyPhone())}
</section>

<section id="privado" data-enter>
<p class="serif line">Un rollo solo lo ven quienes están en él.</p>
</section>

<section id="cierre" data-enter>
<h2 class="serif">Estrenalo en tu próximo viaje.</h2>
${button}
<p class="help">¿Tenés dudas? <a id="soporte" href="/soporte">Soporte y preguntas frecuentes</a></p>
</section>`;

  return { head, body };
}

export const homeCss = `
.js-motion #revelado .photo[data-reveal]{filter:blur(10px) sepia(.8)}
.js-motion [data-enter]{opacity:0;transform:translateY(16px)}
${tokensCss}
:root{--screen:#F7F6F2;--bezel:#111}
@media (prefers-color-scheme:dark){:root{--screen:#17181e;--bezel:#2a2c35}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.55 -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif}
.wrap.wide{max-width:1040px;margin:0 auto;padding:20px 16px 40px}
a{color:var(--tint)}
a:focus-visible{outline:3px solid var(--tint);outline-offset:3px;border-radius:4px}
.serif{font-family:ui-serif,"New York",Georgia,serif;font-weight:500}
header.top a{display:inline-flex;align-items:center;gap:10px;color:var(--fg);text-decoration:none;font-weight:600;font-size:19px}
.logo{color:var(--tint);flex:none}
h1,h2,h3,p,ol,figure{margin:0}
h1,h2,.line{text-wrap:balance}
h1{font-size:clamp(40px,11vw,64px);line-height:1.04;letter-spacing:-.01em;margin-bottom:18px}
h2{font-size:clamp(28px,7vw,38px);line-height:1.15;margin-bottom:14px}
h3{font-size:17px;font-weight:600;margin:22px 0 4px}
p+p{margin-top:12px}
.text p{color:var(--muted)}
.lead{font-size:19px;max-width:30em}
section{padding:56px 0;border-top:1px solid var(--rule)}
section.hero{border-top:0;padding-top:36px}
.cta{margin-top:28px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:12px 28px;background:var(--tint);color:#fff;text-decoration:none;font-weight:700;font-size:20px;border-radius:999px}
.store{display:inline-block;line-height:0}
.store img{display:block}
.note{margin-top:10px;font-size:15px;color:var(--muted)}
.figure{display:flex;justify-content:center;margin-top:40px}
.phone{width:240px;aspect-ratio:9/19.5;border-radius:40px;background:var(--bezel);padding:9px;box-shadow:0 24px 48px rgba(0,0,0,.16)}
.hero-video{width:100%;height:100%;object-fit:cover;border-radius:31px;display:block}
.screen{width:100%;height:100%;border-radius:32px;background:var(--screen);overflow:hidden}
.moment-mark{position:relative;width:min(100%,360px);aspect-ratio:1}
.moment-mark svg,.moment-anim{position:absolute;inset:0;width:100%;height:100%;display:block}
.moment-mark.playing .moment-static{visibility:hidden}
.steps{list-style:none;padding:0;display:grid;gap:40px;counter-reset:step}
.steps li{counter-increment:step}
.steps h3{margin-top:0;font-size:19px}
.steps h3::before{content:counter(step);font:500 22px/1 ui-serif,"New York",Georgia,serif;color:var(--muted);margin-right:10px}
.steps p{color:var(--muted)}
.steps .figure{margin-top:24px}
.steps .phone{width:180px}
#privado{text-align:center}
.line{font-size:clamp(24px,6vw,32px);line-height:1.25;max-width:20em;margin:0 auto}
#cierre{text-align:center}
#cierre .help{margin-top:28px;color:var(--muted)}
footer{margin-top:0;padding-top:16px;border-top:1px solid var(--rule);color:var(--muted);font-size:14px}
footer p{margin:0 0 6px}
footer a{color:var(--muted)}
@media (min-width:768px){
  .wrap.wide{padding:28px 32px 48px}
  section{padding:88px 0}
  h1{font-size:clamp(44px,6vw,64px)}
  .hero,.feature{display:grid;grid-template-columns:1.15fr .85fr;gap:56px;align-items:center}
  .feature.flip .text{order:2}
  .hero .figure,.feature .figure{margin-top:0}
  .hero .phone{width:270px}
  .feature .text{max-width:30em}
  .steps{grid-template-columns:repeat(3,1fr);gap:32px}
  .steps .phone{width:180px}
}
`;
