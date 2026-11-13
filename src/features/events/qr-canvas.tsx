import { Canvas, Path, Rect, Skia } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { qrMatrix } from "./qr";

/** Quiet zone around the code, in modules (the QR spec asks for 4). */
const QUIET = 4;
/** Side of the shared image, about: it's printed on wedding tables, so it must stay sharp. */
const PNG_SIDE = 1024;

/** Whole pixels per module so every edge lands on a pixel (crisp, and scanners like it), and the side that gives. */
function layout(text: string, maxSide: number) {
  const matrix = qrMatrix(text);
  const modules = matrix.length + QUIET * 2;
  const module = Math.max(1, Math.floor(maxSide / modules));
  return { matrix, module, side: module * modules };
}

/** One SVG path with a square per dark module. */
function qrPath(matrix: boolean[][], module: number) {
  const squares: string[] = [];
  matrix.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) squares.push(`M${(c + QUIET) * module} ${(r + QUIET) * module}h${module}v${module}h${-module}z`);
    }),
  );
  return Skia.Path.MakeFromSVGString(squares.join(""));
}

/** The QR as a ~1024 px PNG (quiet zone and white background included), drawn offscreen; null if it can't be rendered. */
export function qrPng(text: string): Uint8Array | null {
  const { matrix, module, side } = layout(text, PNG_SIDE);
  const surface = Skia.Surface.MakeOffscreen(side, side);
  const path = qrPath(matrix, module);
  if (!surface || !path) return null;
  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color("#fff"));
  const paint = Skia.Paint();
  paint.setColor(Skia.Color("#000"));
  canvas.drawPath(path, paint);
  surface.flush();
  return surface.makeImageSnapshot().encodeToBytes();
}

/** The QR on screen: dark modules on white (scanners need the contrast in dark mode too), at a whole pixel per module. */
export function QrCanvas({ text, size }: { text: string; size: number }) {
  const { path, side } = useMemo(() => {
    const l = layout(text, size);
    return { path: qrPath(l.matrix, l.module), side: l.side };
  }, [text, size]);
  return (
    <Canvas style={{ width: side, height: side }} accessibilityLabel="Código QR">
      <Rect x={0} y={0} width={side} height={side} color="#fff" />
      {path && <Path path={path} color="#000" />}
    </Canvas>
  );
}
