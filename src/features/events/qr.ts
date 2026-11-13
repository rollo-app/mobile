import QRCode from "qrcode";

/** The QR of `text` as rows of modules (true = dark), without the quiet zone. */
export function qrMatrix(text: string): boolean[][] {
  const { size, data } = QRCode.create(text, { errorCorrectionLevel: "M" }).modules;
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => data[row * size + col] === 1));
}
