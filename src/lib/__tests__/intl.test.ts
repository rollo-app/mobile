import { dateFormatter } from "../intl";

describe("dateFormatter", () => {
  it("returns the same instance for the same locale and options", () => {
    expect(dateFormatter("es-AR", { timeZone: "UTC", day: "numeric" })).toBe(
      dateFormatter("es-AR", { timeZone: "UTC", day: "numeric" }),
    );
  });

  it("returns different instances for a different time zone, locale or options", () => {
    const base = dateFormatter("es-AR", { timeZone: "UTC" });
    expect(dateFormatter("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })).not.toBe(base);
    expect(dateFormatter("en-CA", { timeZone: "UTC" })).not.toBe(base);
    expect(dateFormatter("es-AR", { timeZone: "UTC", day: "numeric" })).not.toBe(base);
  });

  it("formats like a fresh Intl.DateTimeFormat", () => {
    const options = { timeZone: "UTC", day: "numeric", month: "long" } as const;
    expect(dateFormatter("es-AR", options).format(0)).toBe(new Intl.DateTimeFormat("es-AR", options).format(0));
  });
});
