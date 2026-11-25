import { API_URL } from "@/config";
import { coverUri } from "../cover-uri";

describe("coverUri", () => {
  it("is null without a cover", () => {
    expect(coverUri(null)).toBeNull();
    expect(coverUri(undefined)).toBeNull();
    expect(coverUri("")).toBeNull();
  });

  it("keeps a local file as is", () => {
    expect(coverUri("file:///tmp/cover.jpg")).toBe("file:///tmp/cover.jpg");
  });

  it("puts a server path under the API", () => {
    expect(coverUri("/trips/t/cover")).toBe(`${API_URL}/trips/t/cover`);
  });
});
