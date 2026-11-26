// The trip film engine: the contract between the pure scene and the Skia renderer.
// Types only, no imports: `scene.ts` (pure, runs with `node --experimental-strip-types`) and `draw.ts` (Skia) both code against it.
//
// The idea of the engine: the film is a pure function of time. `frameAt(scene, t)` says what is on the frame at
// millisecond `t` as plain data (a `FrameModel`), and the renderer paints that data. The same two functions play it on
// screen (once per display frame) and, later, export it (once per video frame). Nothing in it depends on a live map:
// the map is a few static images ("layers") that the camera moves like photos.
//
// UNITS. "Film points": the frame is `frame.w` × `frame.h` (9:16), origin top-left, y down. Mercator: the unit square
// (x = (lng + 180) / 360, y grows south), where the world is `512 * 2 ** zoom` film points wide. Times in ms from the
// start of the film (the cover fades at 0).

export type Size = { w: number; h: number };
export type Pt = { x: number; y: number };

/** What the screen hands to `buildScene`. Everything already computed elsewhere (stops, timeline) comes in as plain data. */
export type SceneInput = {
  frame: Size;
  /** Picks the layouts and their small variations: another seed, another arrangement of the same film. */
  seed: number;
  /** Travel zoom: the zoom of the film while it sits on a stop. */
  zoom: number;
  /** The roll's name, the opening line under it ("24 días · 1.858 km") and the closing one ("24 días · 1.858 km · 11 fotos"). */
  name: string;
  hookStats: string;
  closingStats: string;
  /** Who took each shown photo (by photo id): the avatar on its print. `avatar` is a key into the loaded images, null = initial only. */
  authors: Record<string, { initial: string; color: string; avatar: string | null }>;
  stops: {
    /** Mercator of the stop. */
    x: number;
    y: number;
    /** Photo ids of its shots, in time order (1 to 4). The first one is on the pin. */
    shots: string[];
    /** The day title while each shot is on screen ("Día 4"), aligned with `shots`. */
    days: string[];
    /** Place name ("Perast, Montenegro") or null. */
    place: string | null;
  }[];
  /** Same shape as `Timeline` in `../route.ts`. */
  timeline: {
    arrive: number[];
    leave: number[];
    depart: number[];
    move: number[];
    swaps: number[][];
    overviewAt: number;
    hitAt: number;
    titleAt: number;
    doneAt: number;
  };
  timing: { hookMs: number; diveMs: number; overviewMs: number; dwellMs: number; extraPhotoMs: number; developMs: number; cardLeaveMs: number; pushIn: number; /** The end card after `doneAt` (fade to black included); 0 = none. */ endCardMs: number; redLight: boolean };
};

/**
 * A static map image. Its centre in mercator, the film zoom at which one of its points is one film point, and its size
 * in film points at that zoom. The renderer asks MapLibre for exactly this (and may use fewer pixels per point).
 */
export type MapLayerSpec = {
  cx: number;
  cy: number;
  zoom: number;
  w: number;
  h: number;
  /**
   * With the map's place names, or without. Names belong on an image the film rests on; on one it only crosses they
   * would swell with the zoom (they are part of the picture), which is the one thing a real map never does.
   */
  labels: boolean;
};

/** How a stop shows its shots. */
export type LayoutKind =
  /** One print rising from the pin. With several shots they take turns on the same print. */
  | "print"
  /** One print that takes the frame, pin included. With several shots they take turns on it. */
  | "big"
  /** Two prints side by side, the second arriving after the first. */
  | "pair"
  /** Three prints, two side by side and the third over their lower corners, arriving one by one. */
  | "trio"
  /** Four shots as the 2×2 cells of one large print, developing one by one. */
  | "grid";

export type Scene = {
  input: SceneInput;
  /** Where a stop sits on the frame while the camera is on it. */
  anchor: Pt;
  /** The camera that shows the whole route: mercator of the frame's centre, and zoom. */
  overview: { cx: number; cy: number; zoom: number };
  /**
   * `layers[0]` is the overview; `layers[i + 1]` is stop `i` at the travel zoom; after those, one per `hopViews` entry;
   * last, the overview again without names (`overviewBare`).
   */
  layers: MapLayerSpec[];
  /** Index of the overview without names: what is under everything while the camera is closer than the overview. */
  overviewBare: number;
  /** Hop `i` goes from stop `i` to `i + 1`: "pan" slides at the travel zoom, "dip" pulls out until both stops fit and back in. */
  hops: ("pan" | "dip")[];
  /**
   * For a dip, the camera that holds both of its stops (only as far out as they need) and the index of its map layer.
   * Null for a pan, and for a dip between stops so far apart that it goes out to the overview itself.
   */
  hopViews: ({ cx: number; cy: number; zoom: number; layer: number } | null)[];
  /** The layout of each stop, chosen with the seed among those that fit its number of shots. */
  layouts: LayoutKind[];
  /** A small per-stop variation (-1 or 1): which way its prints lean. */
  lean: number[];
  /**
   * Every text the film shows, laid out once by the renderer (the role picks size and weight) and referred to by index
   * from the frame. The same words in two roles are two entries.
   */
  texts: SceneText[];
  /** Index in `texts` of each photo's author initial (by photo id). */
  authorTexts: Record<string, number>;
  /** The whole film, including the closing title's hold (`timeline.doneAt`) and the end card after it. */
  durationMs: number;
};

export type TextRole = "day" | "place" | "hookName" | "hookStats" | "kicker" | "closingName" | "closingStats" | "endName" | "badgeSmall" | "badgeBig" | "initial" | "credit";
export type SceneText = { text: string; role: TextRole };

/**
 * A photo on a print: which one, how developed (0 = blurry sepia, 1 = sharp colour; a negative value = not there yet,
 * the window is empty paper), and how far zoomed into its window (1 = fits).
 */
export type PrintPhoto = { photo: string; develop: number; zoomIn: number };

/**
 * A white print. Centre on the frame, width in film points (the renderer derives the height from the paper's shape),
 * rotation in degrees, scale about its centre, opacity. One photo, or four as a 2×2 grid.
 */
export type PrintModel = { x: number; y: number; width: number; rotation: number; scale: number; opacity: number; photos: PrintPhoto[] };

/** Everything on the frame at one instant, bottom to top in the order the renderer paints it. */
export type FrameModel = {
  /** Map images, bottom to top: where the image's centre lands on the frame, its scale and opacity. */
  map: { layer: number; x: number; y: number; scale: number; opacity: number }[];
  /**
   * Map images the next move will show, named a little ahead while the frame is still. An image is decoded the first
   * time it is painted, which takes several frames: the renderer touches these so that never lands inside a move.
   */
  warm: number[];
  /** The route drawn so far, in frame points (fewer than 2 points: no line). */
  line: Pt[];
  /** Photo pins of the stops reached. `scale` 0 → 1 as they pop; `current` rings the one the camera is on. */
  pins: { stop: number; x: number; y: number; scale: number; current: boolean }[];
  /** The darkroom light over the map and the pins: 1 = red and dim, 0 = off. */
  light: number;
  prints: PrintModel[];
  /** Day ("Día 4") and place under it, as indexes into `scene.texts` (-1 = none), with one opacity. Null: no title. */
  title: { day: number; place: number; opacity: number } | null;
  /** The opening lines over the overview: indexes into `scene.texts`, and their opacity. */
  hook: { name: number; stats: number; opacity: number };
  /** The closing block: indexes into `scene.texts`, and its opacity. */
  closing: { kicker: number; name: number; stats: number; opacity: number };
  /** The white flash of the hit, 0..1. */
  flash: number;
  /** The end card, over everything: solid black fading in over the film, with its logo and badge. Opacity 0 = none (indexes are -1). */
  endCard: { opacity: number; name: number; badgeSmall: number; badgeBig: number };
  /** The map credit, small at the bottom left: index into `scene.texts` and opacity (1 while the map shows, 0 as the end card takes over). */
  credit: { text: number; opacity: number };
};

// The paper's shape (`PAPER`, `printHeight`) lives in `scene.ts`, which must stay free of value imports to run under
// node; the renderer imports it from there.
