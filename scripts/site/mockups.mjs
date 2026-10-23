// Stylized phone mockups of the app for the home: plain HTML/CSS and inline SVG, no images. They show the app's
// screens (Rollo board, capture, map + feed, reveal, profile) without imitating a screenshot. Every mockup is
// aria-hidden: the figure around it carries the Spanish label.

/** Photo blobs, like the ThumbHash the app shows before the reveal (palette from the approved hero mockup). */
const PALETTE = [
  ["#8fb3d9", "#e9d6b0"],
  ["#4d6b4a", "#a9c48d"],
  ["#d98f6b", "#f2d5a0"],
  ["#2e4157", "#7d9bb8"],
  ["#c9b38a", "#f4ead6"],
  ["#6b4d3a", "#c49a77"],
  ["#a3c2c9", "#e8eef0"],
  ["#5a6e8c", "#d6b59a"],
  ["#879a6b", "#e1dcb5"],
  ["#d9a3a3", "#f2e4d0"],
  ["#384a3a", "#8ea58a"],
  ["#e0b56b", "#f7ecd3"],
];

/** A few friends, each on their member color (the app's iOS system palette). */
const PEOPLE = {
  cami: { initial: "C", color: "#FF2D55" },
  lu: { initial: "L", color: "#5856D6" },
  juani: { initial: "J", color: "#007AFF" },
  tomi: { initial: "T", color: "#00A39C" },
  fede: { initial: "F", color: "#A2845E" },
  juan: { initial: "J", color: "#FF9500" },
};

const photo = (i, extra = "") => {
  const [a, b] = PALETTE[i % PALETTE.length];
  return `<span class="photo" style="--a:${a};--b:${b}"${extra}></span>`;
};

const avatar = (who, cls = "av") => {
  const p = PEOPLE[who];
  return `<span class="${cls}" style="--m:${p.color}">${p.initial}</span>`;
};

const svg = (d, cls = "") =>
  `<svg${cls ? ` class="${cls}"` : ""} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const ICONS = {
  roll: `<rect x="3" y="7" width="14" height="14" rx="2.5"/><path d="M7 3.5h11a2.5 2.5 0 0 1 2.5 2.5v11"/>`,
  map: `<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4z"/><path d="M9 4v14M15 6v14"/>`,
  camera: `<path d="M4 8.5h3.2L9 6h6l1.8 2.5H20V19H4z"/><circle cx="12" cy="13.5" r="3.3"/>`,
  friends: `<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.4-3.3 2.8-5.2 6-5.2s5.6 1.9 6 5.2"/><circle cx="17" cy="9.5" r="2.4"/><path d="M16.5 14.4c2.6.2 4.2 1.9 4.5 4.6"/>`,
  profile: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3.2"/><path d="M6.4 18.4c1.3-2 3.3-3.1 5.6-3.1s4.3 1.1 5.6 3.1"/>`,
  gallery: `<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.5"/>`,
  stories: `<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9.2 5 2.8-5 2.8z"/>`,
  gear: `<circle cx="12" cy="12" r="8.2" stroke-width="3" stroke-dasharray="3.2 3.24" stroke-linecap="butt"/><circle cx="12" cy="12" r="6.2"/><circle cx="12" cy="12" r="2.2"/>`,
  chevron: `<path d="m7 10 5 5 5-5"/>`,
  cloud: `<path d="M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/>`,
};

const BEFORE_REVEAL = ["roll", "map", "camera", "friends", "profile"];
const AFTER_REVEAL = ["gallery", "map", "stories", "friends", "profile"];

/** The native bottom tab bar: icons only, the active tab tinted. */
const tabs = (set, active) =>
  `<div class="tabs">${set.map((name) => svg(ICONS[name], name === active ? "on" : "")).join("")}</div>`;

const statusBar = `<div class="status"><span>9:41</span><span class="island"></span><span class="bars"><i></i><i></i><i></i><b></b></span></div>`;

const segmented = (left, right) => `<div class="seg"><span class="sel">${left}</span><span>${right}</span></div>`;

/** Shared frame: every mockup root is `.phone` and hidden from screen readers. */
const phone = (kind, content) =>
  `<div class="phone" aria-hidden="true"><div class="screen m-${kind}">${statusBar}${content}</div></div>`;

const rollSheet = () =>
  phone(
    "roll",
    `<div class="bar"><span></span>${svg(ICONS.cloud, "muted")}</div>
<h4 class="title switch">Bariloche ${svg(ICONS.chevron)}</h4>
<p class="sub">8 personas · se revela el domingo</p>
<div class="sheet">${PALETTE.map((_, i) => photo(i)).join("")}</div>
<div class="group"><div class="row"><span>Hoy</span><span class="value">Te quedan 7 fotos</span></div><div class="row"><span>Fechas</span><span class="value">18 al 24 de enero</span></div><div class="row"><span>En el rollo</span><span class="faces">${["cami", "lu", "juani", "tomi"].map((w) => avatar(w)).join("")}</span></div></div>
${tabs(BEFORE_REVEAL, "roll")}`,
  );

const steps = () => [
  phone(
    "join",
    `<h4 class="title">Unirse a un rollo</h4>
<p class="sub">Pedile el código a alguien del rollo.</p>
<div class="code">${[..."BRL4K2"].map((c) => `<span>${c}</span>`).join("")}</div>
<span class="action">Unirme</span>
${tabs(BEFORE_REVEAL, "roll")}`,
  ),
  phone(
    "capture",
    `<div class="preview">${photo(1)}</div>
<p class="caption">Agregá un caption</p>
<div class="controls"><span class="retake">Repetir</span><span class="send">Mandar al rollo</span></div>`,
  ),
  phone(
    "gallery",
    `${segmented("Galería", "Rollo")}
<div class="grid">${[3, 0, 5, 8, 2, 10, 6, 11, 4].map((i) => photo(i)).join("")}</div>
${tabs(AFTER_REVEAL, "gallery")}`,
  ),
];

const map = () =>
  phone(
    "map",
    `${segmented("Mapa", "Feed")}
<div class="land">
<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path class="water" d="M0 38c14-6 22 4 34 0s18-16 32-12 22 14 34 10v26c-12 4-22-6-34-2s-16 14-30 12S10 60 0 64z"/><path class="park" d="M8 6c10-3 20 2 22 10s-8 12-18 10S-2 9 8 6z"/><path class="park" d="M64 74c9-3 22 0 24 8s-8 13-18 11-15-16-6-19z"/><path class="road" d="M-2 88c20-6 34-14 50-14s34-8 54-22"/><path class="road" d="M40 -2c2 12 8 18 6 28"/></svg>
<span class="pin" style="--m:${PEOPLE.cami.color};left:22%;top:24%">C</span>
<span class="pin" style="--m:${PEOPLE.lu.color};left:64%;top:16%">L</span>
<span class="pin" style="--m:${PEOPLE.juani.color};left:46%;top:70%">J</span>
<span class="pin" style="--m:${PEOPLE.tomi.color};left:78%;top:62%">T</span>
</div>
<div class="feed">
<div class="item">${avatar("cami")}<span class="what"><b>Cami</b> sacó una foto · 14:32</span>${photo(0)}</div>
<div class="item">${avatar("lu")}<span class="what"><b>Lu</b> sacó una foto · 14:35</span>${photo(4)}</div>
</div>
${tabs(BEFORE_REVEAL, "map")}`,
  );

const reveal = () =>
  phone(
    "reveal",
    `<p class="serif kicker">Se reveló</p>
<h4 class="title">Bariloche</h4>
<p class="sub">64 fotos · 8 personas · 6 días</p>
<div class="grid">${PALETTE.map((_, i) => photo(i, " data-reveal")).join("")}</div>
${tabs(AFTER_REVEAL, "gallery")}`,
  );

const profile = () => {
  // Featured photos; the ones a friend took carry the author's badge.
  const featured = [
    [7],
    [2, "lu"],
    [9],
    [1],
    [11, "tomi"],
    [3],
    [6, "fede"],
    [10],
    [0],
  ];
  return phone(
    "profile",
    `<div class="bar"><span></span>${svg(ICONS.gear, "muted")}</div>
<div class="head">${avatar("juan", "me")}<div><h4>Juan Pérez</h4><p class="handle">@juanperez</p></div></div>
<p class="bio serif">Viajes al sur y fotos de ruta.</p>
<p class="friends">48 amigos</p>
${segmented("Fotos", "Mapa")}
<div class="grid">${featured
      .map(([i, who]) => `<span class="cell">${photo(i)}${who ? avatar(who, "badge") : ""}</span>`)
      .join("")}</div>
${tabs(BEFORE_REVEAL, "profile")}`,
  );
};

export const mockups = { rollSheet, steps, map, reveal, profile };

/** Styles for the mockups. Static state is final: photos are sharp (Task 4's `.js-motion` adds the blur). */
export const mockupsCss = `
:root{--s-fg:#1c1c1e;--s-muted:#8a8a8e;--s-group:#fff;--s-sep:#e6e3dc;--s-seg:#e8e6e0;--s-sel:#fff;--s-land:#ece7da;--s-water:#c9d9e3;--s-park:#d9dfc6;--s-road:#fff;--s-glass:rgba(247,246,242,.92)}
@media (prefers-color-scheme:dark){:root{--s-fg:#f2f2f7;--s-muted:#8d8d93;--s-group:#22232a;--s-sep:#2e3038;--s-seg:#26272e;--s-sel:#3a3b44;--s-land:#2a2b31;--s-water:#1e3343;--s-park:#28352a;--s-road:#474a54;--s-glass:rgba(23,24,30,.92)}}
.phone{container-type:inline-size;flex:none}
.screen{position:relative;display:flex;flex-direction:column;color:var(--s-fg);font-size:10px;font-size:4.5cqw;line-height:1.3;padding:0 1.1em;text-align:left}
.screen svg{display:block}
.screen .photo{display:block;background:linear-gradient(135deg,var(--a),var(--b));border-radius:.25em;aspect-ratio:1}
.screen .status{display:flex;align-items:center;justify-content:space-between;height:4.4em;font-weight:600;font-size:.95em;padding:0 .9em;flex:none}
.screen .island{width:7.6em;height:2.2em;border-radius:2em;background:#000}
.screen .bars{display:flex;align-items:flex-end;gap:.15em}
.screen .bars i{width:.3em;background:currentColor;border-radius:.1em}
.screen .bars i:nth-child(1){height:.45em}.screen .bars i:nth-child(2){height:.7em}.screen .bars i:nth-child(3){height:.95em}
.screen .bars b{width:1.9em;height:.95em;margin-left:.35em;border-radius:.3em;background:currentColor}
.screen .title{font-size:2.3em;font-weight:700;line-height:1.1;letter-spacing:-.01em;margin:0}
.screen .sub{font-size:1.05em;color:var(--s-muted);margin:.3em 0 1em}
.screen .serif{font-family:ui-serif,"New York",Georgia,serif}
.screen .muted{width:1.9em;color:var(--s-muted)}
.screen .bar{display:flex;align-items:center;justify-content:space-between;height:2.6em;flex:none}
.screen .switch{display:flex;align-items:center;gap:.15em}
.screen .switch svg{width:.7em;color:var(--tint);stroke-width:2.6}
.screen .av,.screen .me,.screen .badge,.screen .pin{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:var(--m);color:#fff;font-weight:600;flex:none}
.screen .av{width:2.2em;height:2.2em;font-size:.95em}
.screen .sheet{display:grid;grid-template-columns:repeat(4,1fr);gap:.3em}
.screen .group{margin-top:1.2em;background:var(--s-group);border-radius:.9em;padding:0 1em}
.screen .row{display:flex;align-items:center;justify-content:space-between;min-height:3.2em;gap:.6em}
.screen .row+.row{border-top:1px solid var(--s-sep)}
.screen .value{color:var(--s-muted)}
.screen .faces{display:flex}
.screen .faces .av{box-shadow:0 0 0 .18em var(--s-group)}
.screen .faces .av+.av{margin-left:-.5em}
.screen .tabs{margin:auto -1.1em 0;display:flex;justify-content:space-around;align-items:center;height:5.6em;padding-bottom:1.4em;background:var(--s-glass);border-top:1px solid var(--s-sep);color:var(--s-muted);flex:none}
.screen .tabs svg{width:2.3em}
.screen .tabs .on{color:var(--tint)}
.screen .seg{display:flex;margin:.4em 0 1em;padding:.2em;border-radius:.7em;background:var(--s-seg);font-weight:600;font-size:1em;flex:none}
.screen .seg span{flex:1;text-align:center;padding:.35em 0;border-radius:.55em}
.screen .seg .sel{background:var(--s-sel);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.screen .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.2em;margin:0 -1.1em}
.screen .grid .photo{border-radius:0}
/* Join */
.m-join .title{margin-top:1.6em;font-size:2em}
.screen .code{display:grid;grid-template-columns:repeat(6,1fr);gap:.35em;margin:.6em 0 1.6em}
.screen .code span{display:flex;align-items:center;justify-content:center;aspect-ratio:3/4;border-radius:.5em;background:var(--s-group);font:600 1.6em ui-monospace,Menlo,monospace}
.screen .action,.screen .send{display:flex;align-items:center;justify-content:center;border-radius:2em;background:var(--tint);color:#fff;font-weight:700}
.screen .action{height:3.6em;font-size:1.15em}
/* Capture: the sharp preview before sending */
.m-capture{background:#000;color:#fff}
.screen .preview{flex:1;display:flex;align-items:center;margin:0 -1.1em}
.screen .preview .photo{width:100%;aspect-ratio:3/4;border-radius:0}
.screen .caption{margin:.9em 0 0;font-family:ui-serif,"New York",Georgia,serif;font-size:1.2em;color:rgba(255,255,255,.55)}
.screen .controls{display:flex;align-items:center;justify-content:space-between;height:6.4em;padding-bottom:1.4em;flex:none}
.screen .retake{font-weight:600;font-size:1.1em}
.screen .send{height:3.2em;padding:0 1.3em;font-size:1.1em}
/* Map + feed */
.screen .land{position:relative;flex:1;margin:0 -1.1em;background:var(--s-land);overflow:hidden}
.screen .land svg{position:absolute;inset:0;width:100%;height:100%}
.screen .water{fill:var(--s-water)}
.screen .park{fill:var(--s-park)}
.screen .road{fill:none;stroke:var(--s-road);stroke-width:2.4;vector-effect:non-scaling-stroke}
.screen .pin{position:absolute;width:2.6em;height:2.6em;margin:-1.3em 0 0 -1.3em;font-size:1em;box-shadow:0 0 0 .22em #fff,0 .2em .6em rgba(0,0,0,.25)}
.screen .feed{margin:0 -1.1em;padding:.4em 1.1em;background:var(--screen);border-top:1px solid var(--s-sep);flex:none}
.screen .item{display:flex;align-items:center;gap:.7em;min-height:3.4em}
.screen .item+.item{border-top:1px solid var(--s-sep)}
.screen .what{flex:1}
.screen .item .photo{width:2.6em}
/* Reveal */
.screen .kicker{font-size:1.2em;color:var(--s-muted);margin:1.2em 0 .1em}
/* Profile */
.screen .head{display:flex;align-items:center;gap:.9em}
.screen .me{width:2.6em;height:2.6em;font-size:2.2em}
.screen .head h4{font-size:1.5em;margin:0;line-height:1.15}
.screen .handle{color:var(--s-muted);margin:0}
.screen .bio{margin:.8em 0 .2em;font-size:1.1em}
.screen .friends{color:var(--s-muted);margin:0 0 .4em}
.screen .cell{position:relative;display:block}
.screen .badge{position:absolute;right:.35em;bottom:.35em;width:1.8em;height:1.8em;font-size:.8em;box-shadow:0 0 0 .15em #fff}
`;
