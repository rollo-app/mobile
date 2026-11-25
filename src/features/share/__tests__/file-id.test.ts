import { fileId } from "../file-id";

describe("fileId", () => {
  it("is deterministic", () => {
    expect(fileId("trip:collage:a,b")).toBe(fileId("trip:collage:a,b"));
  });
  it("differs for different keys", () => {
    expect(fileId("trip:collage:a,b")).not.toBe(fileId("trip:collage:b,a"));
    expect(fileId("trip:collage:a")).not.toBe(fileId("trip:invite:a"));
  });
  it("is short hex", () => {
    expect(fileId("x".repeat(1000))).toMatch(/^[0-9a-f]{8}$/);
    expect(fileId("")).toMatch(/^[0-9a-f]{8}$/);
  });
});
