// Generates Rollo's Lottie files (`npm run lottie`). All of them: the "Revelado" mark assembles (the two outer circles
// fade and grow in, the core pops). Transparent, 512x512, 60 fps, play once and hold.
// - moment-intro*.json: plus a cobalt ring drawing around it (the daily moment's 15-minute window). The app's is dark
//   (it always plays over black, like the camera); the light one is for the site.
// - logo-intro-{light,dark}.json: the mark alone, bigger and shorter (the app's first welcome).
// - app-intro-{light,dark}.json: the mark alone at half speed (the full-screen intro for a new account).
import { writeFileSync } from "node:fs";

const FR = 60;
const C = 256;

// colors.tint (#3155F5 light, #5C7CFF dark).
const COBALT = {
  light: [0x31 / 255, 0x55 / 255, 0xf5 / 255, 1],
  dark: [0x5c / 255, 0x7c / 255, 0xff / 255, 1],
};
const ease = {
  settle: { o: [0.0, 0.65], i: [0.51, 0.99] },
  entrance: { o: [0.2, 0.75], i: [0.34, 0.94] },
};

/** Animated property from [frame, value, easingName?] keys (easing applies to the segment that starts there). */
function anim(keys, dims) {
  return {
    a: 1,
    k: keys.map(([t, v, e], idx) => {
      const s = Array.isArray(v) ? v : [v];
      const k = { t, s };
      const next = keys[idx + 1];
      if (next) {
        const curve = ease[e ?? "settle"];
        k.o = { x: Array(dims).fill(curve.o[0]), y: Array(dims).fill(curve.o[1]) };
        k.i = { x: Array(dims).fill(curve.i[0]), y: Array(dims).fill(curve.i[1]) };
      }
      return k;
    }),
  };
}
const stat = (k) => ({ a: 0, k });

function layer(OP, ind, nm, shapes, ks = {}) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm,
    sr: 1,
    ks: {
      o: ks.o ?? stat(100),
      r: stat(0),
      p: stat([0, 0, 0]),
      a: stat([0, 0, 0]),
      s: stat([100, 100, 100]),
    },
    ao: 0,
    shapes,
    ip: 0,
    op: OP,
    st: 0,
    bm: 0,
  };
}

/** One circle of the mark: logo-space center/radius, fading in to `opacity` while it scales up. */
function circle({ OP, S, color, pace }, ind, nm, [lx, ly, lr], opacity, scaleKeys, opacityKeys) {
  const center = [C + (lx - 60) * S, C + (ly - 60) * S];
  const d = lr * 2 * S;
  return layer(OP, ind, nm, [
    {
      ty: "gr",
      nm,
      it: [
        { ty: "el", nm: "disc", p: stat([0, 0]), s: stat([d, d]) },
        { ty: "fl", nm: "fill", c: { sid: "accentColor", a: 0, k: color }, o: stat(opacity), r: 1 },
        {
          ty: "tr",
          p: stat(center),
          a: stat([0, 0]),
          s: anim(scaleKeys.map(([t, v, e]) => [Math.round(t * pace), [v, v], e]), 2),
          r: stat(0),
          o: anim(opacityKeys.map(([t, v, e]) => [Math.round(t * pace), v, e]), 1),
        },
      ],
    },
  ]);
}

/**
 * The mark, with the moment's ring or alone. `S` scales logo units (its 120 box) to px; `pace` stretches the mark's
 * timing (1 = as designed; the ring keeps its own).
 */
function build({ name, color, ring, S, OP, pace = 1 }) {
  const m = { OP, S, color, pace };
  const big = circle(m, 3, "large", [60, 60, 34], 18, [[0, 72], [26, 100]], [[0, 0], [14, 100]]);
  const mid = circle(m, 2, "medium", [66, 54, 24], 38, [[6, 72], [32, 100]], [[6, 0], [20, 100]]);
  // The core is the focal element: the only one with a pop (overshoot, then settle back).
  const core = circle(
    m,
    1,
    "core",
    [71, 49, 14],
    100,
    [[14, 45, "entrance"], [28, 112], [40, 100]],
    [[14, 0], [20, 100]],
  );

  // The 15-minute window: a ring that draws clockwise from 12 o'clock, then holds.
  const R = 118;
  const windowRing = layer(OP, 4, "window ring", [
    {
      ty: "gr",
      nm: "ring",
      it: [
        { ty: "el", nm: "ring path", p: stat([0, 0]), s: stat([R * 2, R * 2]) },
        {
          ty: "st",
          nm: "stroke",
          c: { sid: "accentColor", a: 0, k: color },
          o: stat(100),
          w: { sid: "ringWidth", a: 0, k: 6 },
          lc: 2,
          lj: 2,
        },
        {
          ty: "tm",
          nm: "draw",
          s: stat(0),
          e: anim([[34, 0, "entrance"], [82, 100]], 1),
          o: stat(0),
          m: 1,
        },
        { ty: "tr", p: stat([C, C]), a: stat([0, 0]), s: stat([100, 100]), r: stat(0), o: anim([[34, 0], [38, 100]], 1) },
      ],
    },
  ]);

  return {
    v: "5.12.0",
    fr: FR,
    ip: 0,
    op: OP,
    w: 512,
    h: 512,
    nm: name,
    ddd: 0,
    assets: [],
    slots: {
      accentColor: { p: { a: 0, k: color } },
      ...(ring ? { ringWidth: { p: { a: 0, k: 6 } } } : {}),
    },
    layers: ring ? [core, mid, big, windowRing] : [core, mid, big],
  };
}

function write(path, doc) {
  const out = new URL(path, import.meta.url);
  writeFileSync(out, JSON.stringify(doc));
  console.log("Wrote", out.pathname);
}

const moment = { name: "Rollo - Tu momento", ring: true, S: 2.6, OP: 96 };
const logo = { name: "Rollo - Bienvenida", ring: false, S: 3.6, OP: 48 };
write("../assets/lottie/moment-intro.json", build({ ...moment, color: COBALT.dark }));
write("../scripts/site/moment-intro-light.json", build({ ...moment, color: COBALT.light }));
write("../scripts/site/moment-intro-dark.json", build({ ...moment, color: COBALT.dark }));
write("../assets/lottie/logo-intro-light.json", build({ ...logo, color: COBALT.light }));
write("../assets/lottie/logo-intro-dark.json", build({ ...logo, color: COBALT.dark }));
// The app's full-screen intro for a new account: the same mark, bigger and slower (~1.6 s).
const appIntro = { name: "Rollo - Intro", ring: false, S: 3.6, OP: 96, pace: 2 };
write("../assets/lottie/app-intro-light.json", build({ ...appIntro, color: COBALT.light }));
write("../assets/lottie/app-intro-dark.json", build({ ...appIntro, color: COBALT.dark }));
