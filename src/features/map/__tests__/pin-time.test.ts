import { formatPinTime } from "../pin-time";

const TZ = "America/Argentina/Buenos_Aires"; // UTC-3
const at = (iso: string) => Date.parse(iso);

describe("formatPinTime", () => {
  const now = at("2027-01-14T18:00:00Z"); // jueves 14, 15:00 en el viaje

  it("hoy con la hora del viaje", () => {
    expect(formatPinTime(at("2027-01-14T16:10:00Z"), TZ, now)).toBe("hoy 13:10");
  });

  it("ayer", () => {
    expect(formatPinTime(at("2027-01-14T00:40:00Z"), TZ, now)).toBe("ayer 21:40");
  });

  it("días anteriores con día de la semana y número", () => {
    expect(formatPinTime(at("2027-01-11T16:10:00Z"), TZ, now)).toBe("lun 11 · 13:10");
  });

  it("usa la zona del viaje, no la del celular, para decidir el día", () => {
    // 02:30 UTC del 15 es todavía el 14 a las 23:30 en Buenos Aires
    expect(formatPinTime(at("2027-01-15T02:30:00Z"), TZ, now)).toBe("hoy 23:30");
  });
});
