import { localDay, remaining } from "../quota";

describe("día local del viaje", () => {
  it("usa la zona del viaje, no UTC", () => {
    // 02:00 UTC del 13 son las 23:00 del 12 en Argentina
    expect(localDay(Date.parse("2027-01-13T02:00:00Z"), "America/Argentina/Buenos_Aires")).toBe("2027-01-12");
  });

  it("devuelve la fecha con ceros", () => {
    expect(localDay(Date.parse("2027-03-05T15:00:00Z"), "America/Argentina/Buenos_Aires")).toBe("2027-03-05");
  });
});

describe("lo que te queda hoy", () => {
  const today = { date: "2027-01-12", photosLeft: 7, videosLeft: 2 };

  it("descuenta lo sacado que todavía no se subió", () => {
    expect(remaining(today, "2027-01-12", { photos: 3, videos: 2 })).toEqual({ photos: 4, videos: 0 });
  });

  it("nunca da negativo", () => {
    expect(remaining(today, "2027-01-12", { photos: 9, videos: 0 })).toEqual({ photos: 0, videos: 2 });
  });

  it("si el dato del server es de otro día, no sabe cuánto queda", () => {
    expect(remaining(today, "2027-01-13", { photos: 0, videos: 0 })).toBeNull();
  });

  it("sin dato del server tampoco sabe", () => {
    expect(remaining(null, "2027-01-12", { photos: 0, videos: 0 })).toBeNull();
  });
});
