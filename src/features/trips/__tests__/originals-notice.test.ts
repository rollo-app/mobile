import { originalsNotice } from "../originals-notice";

const TZ = "America/Argentina/Buenos_Aires";
// 2027-12-13 01:00 UTC is still the 12th in Buenos Aires.
const EXPIRES = Date.UTC(2027, 11, 13, 1, 0);

describe("originalsNotice", () => {
  it("tells the date the full-quality photos are deleted, in the roll's zone", () => {
    expect(originalsNotice({ keep: false, expiresAt: EXPIRES, purged: false }, TZ)).toBe(
      "Las fotos en máxima calidad se borran el 12 de diciembre. Guardalas en tu celular antes.",
    );
  });

  it("uses the roll's zone, not the phone's", () => {
    expect(originalsNotice({ keep: false, expiresAt: EXPIRES, purged: false }, "Europe/Madrid")).toContain("el 13 de diciembre");
  });

  it("says they are gone once purged, and that the high quality ones remain", () => {
    expect(originalsNotice({ keep: false, expiresAt: EXPIRES, purged: true }, TZ)).toBe(
      "Las fotos en máxima calidad ya se borraron. Quedan en alta calidad para ver y guardar.",
    );
  });

  it("says nothing when the roll keeps its originals", () => {
    expect(originalsNotice({ keep: true, expiresAt: null, purged: false }, TZ)).toBeNull();
  });

  it("says nothing without an expiry date (and not purged)", () => {
    expect(originalsNotice({ keep: false, expiresAt: null, purged: false }, TZ)).toBeNull();
  });

  it("says nothing when the trip has no originals info (an older server response)", () => {
    expect(originalsNotice(undefined, TZ)).toBeNull();
  });
});
