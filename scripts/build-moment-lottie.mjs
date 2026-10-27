// Generates the daily moment's intro Lottie (assets/lottie/moment-intro.json): Rollo's "Revelado" mark assembles,
// then a cobalt ring draws around it (the moment's 15-minute window). Transparent, 512x512, 60 fps, plays once and
// holds. It always plays over black (like the camera), so it uses the dark cobalt. `npm run lottie` regenerates it.
import { writeFileSync } from "node:fs";

const out = new URL("../assets/lottie/moment-intro.json", import.meta.url);
const FR = 60;
const OP = 96;
const C = 256;
const S = 2.6; // logo units (120 box) -> px

// colors.tint in dark mode (#5C7CFF).
const COBALT = [0x5c / 255, 0x7c / 255, 0xff / 255, 1];
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

function layer(ind, nm, shapes, ks = {}) {
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
function circle(ind, nm, [lx, ly, lr], opacity, scaleKeys, opacityKeys) {
  const center = [C + (lx - 60) * S, C + (ly - 60) * S];
  const d = lr * 2 * S;
  return layer(ind, nm, [
    {
      ty: "gr",
      nm,
      it: [
        { ty: "el", nm: "disc", p: stat([0, 0]), s: stat([d, d]) },
        { ty: "fl", nm: "fill", c: { sid: "accentColor", a: 0, k: COBALT }, o: stat(opacity), r: 1 },
        {
          ty: "tr",
          p: stat(center),
          a: stat([0, 0]),
          s: anim(scaleKeys.map(([t, v, e]) => [t, [v, v], e]), 2),
          r: stat(0),
          o: anim(opacityKeys, 1),
        },
      ],
    },
  ]);
}

const big = circle(3, "large", [60, 60, 34], 18, [[0, 72], [26, 100]], [[0, 0], [14, 100]]);
const mid = circle(2, "medium", [66, 54, 24], 38, [[6, 72], [32, 100]], [[6, 0], [20, 100]]);
// The core is the focal element: the only one with a pop (overshoot, then settle back).
const core = circle(
  1,
  "core",
  [71, 49, 14],
  100,
  [[14, 45, "entrance"], [28, 112], [40, 100]],
  [[14, 0], [20, 100]],
);

// The 15-minute window: a ring that draws clockwise from 12 o'clock, then holds.
const R = 118;
const ring = layer(4, "window ring", [
  {
    ty: "gr",
    nm: "ring",
    it: [
      { ty: "el", nm: "ring path", p: stat([0, 0]), s: stat([R * 2, R * 2]) },
      {
        ty: "st",
        nm: "stroke",
        c: { sid: "accentColor", a: 0, k: COBALT },
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

const doc = {
  v: "5.12.0",
  fr: FR,
  ip: 0,
  op: OP,
  w: 512,
  h: 512,
  nm: "Rollo - Tu momento",
  ddd: 0,
  assets: [],
  slots: {
    accentColor: { p: { a: 0, k: COBALT } },
    ringWidth: { p: { a: 0, k: 6 } },
  },
  layers: [core, mid, big, ring],
};

writeFileSync(out, JSON.stringify(doc));
console.log("Wrote", out.pathname);
