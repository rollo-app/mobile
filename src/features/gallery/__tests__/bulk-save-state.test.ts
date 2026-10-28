import type { RevealedPhoto } from "@/features/media/revealed";
import { resultText, type Bar } from "../bulk-save-state";

type Result = Extract<Bar, { kind: "result" }>;
const result = (over: Partial<Result> = {}): Result => ({
  kind: "result",
  saved: 3,
  failed: [],
  cancelled: false,
  album: false,
  recents: false,
  ...over,
});
const failed = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }) as RevealedPhoto);

describe("resultText", () => {
  it("reports saved and failed counts when some failed", () => {
    expect(resultText(result({ saved: 2, failed: failed(1) }))).toBe(
      "Se guardaron 2. No se pudieron guardar 1 foto.",
    );
    expect(resultText(result({ saved: 2, failed: failed(3) }))).toBe(
      "Se guardaron 2. No se pudieron guardar 3 fotos.",
    );
  });

  it("reports a cancelled pass", () => {
    expect(resultText(result({ saved: 1, cancelled: true }))).toBe("Se guardaron 1 foto antes de cancelar.");
  });

  it("mentions Recientes when the album was wanted but access was limited", () => {
    expect(resultText(result({ saved: 4, recents: true }))).toBe("Se guardaron 4 fotos en Recientes");
  });

  it("confirms a plain success", () => {
    expect(resultText(result({ saved: 5 }))).toBe("Guardadas 5 ✓");
  });
});
