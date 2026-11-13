import { joinLinkUrl } from "../join-link";
import { qrMatrix } from "../qr";

describe("qrMatrix", () => {
  it("encodes the join url and is square", () => {
    const matrix = qrMatrix(joinLinkUrl("ABC123"));
    expect(matrix.length).toBeGreaterThanOrEqual(21);
    expect(matrix.length % 2).toBe(1);
    expect(matrix.every((row) => row.length === matrix.length)).toBe(true);
    // The finder pattern: the top-left corner module is dark.
    expect(matrix[0]![0]).toBe(true);
    expect(matrix.some((row) => row.some((dark) => !dark))).toBe(true);
  });
});

describe("joinLinkUrl", () => {
  it("builds the public join url for the code", () => {
    expect(joinLinkUrl("ABC123")).toBe("https://rolloproject.com/join/ABC123");
  });
});
