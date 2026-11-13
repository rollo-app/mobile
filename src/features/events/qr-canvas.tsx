import { Canvas, Path, Rect, Skia, useCanvasRef, type CanvasRef } from "@shopify/react-native-skia";
import { useMemo, type RefObject } from "react";
import { qrMatrix } from "./qr";

/** Quiet zone around the code, in modules (the QR spec asks for 4). */
const QUIET = 4;

export type QrCanvasRef = RefObject<CanvasRef | null>;
export const useQrCanvasRef = (): QrCanvasRef => useCanvasRef();

/** The canvas as PNG bytes (the quiet zone included); null if it can't be captured. */
export async function snapshotPng(ref: QrCanvasRef): Promise<Uint8Array | null> {
  const image = await ref.current?.makeImageSnapshotAsync();
  return image ? image.encodeToBytes() : null;
}

/** The QR drawn with Skia: dark modules on white (scanners need the contrast in dark mode too). */
export function QrCanvas({ text, size, canvasRef }: { text: string; size: number; canvasRef: QrCanvasRef }) {
  const path = useMemo(() => {
    const matrix = qrMatrix(text);
    const module = size / (matrix.length + QUIET * 2);
    // One SVG path with a square per dark module (a hair of overlap so antialiasing leaves no seams).
    const side = module + 0.5;
    const squares: string[] = [];
    matrix.forEach((row, r) =>
      row.forEach((dark, c) => {
        if (dark) squares.push(`M${(c + QUIET) * module} ${(r + QUIET) * module}h${side}v${side}h${-side}z`);
      }),
    );
    return Skia.Path.MakeFromSVGString(squares.join(""));
  }, [text, size]);
  return (
    <Canvas ref={canvasRef} style={{ width: size, height: size }} accessibilityLabel="Código QR">
      <Rect x={0} y={0} width={size} height={size} color="#fff" />
      {path && <Path path={path} color="#000" />}
    </Canvas>
  );
}
