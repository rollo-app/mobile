import { dateFormatter } from "@/lib/intl";

const DAY_MS = 86_400_000;

/** The calendar day (YYYY-MM-DD) of an instant in a time zone. */
export const localDay = (ms: number, timeZone: string) => dateFormatter("en-CA", { timeZone }).format(ms);

/** Days since the epoch of a YYYY-MM-DD day, to subtract two of them. */
export const dayNumber = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!) / DAY_MS;
};
