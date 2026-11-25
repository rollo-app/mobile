import { localDay } from "@/features/capture/quota";

const DAY = 24 * 60 * 60 * 1000;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * One line about a revealed roll: "64 fotos · 3 videos · 8 personas · 6 días". Days are the trip's
 * calendar days in its zone, both ends included; "0 videos" is left out.
 */
export function rollSummary({
  media,
  mediaCount,
  people,
  startsAt,
  endsAt,
  timeZone,
}: {
  media: { type: string }[];
  /** The roll's real total when `media` is only what has loaded so far. */
  mediaCount?: number;
  people: number;
  startsAt: number;
  endsAt: number;
  timeZone: string;
}) {
  const videos = media.filter((m) => m.type === "video").length;
  const photos = (mediaCount ?? media.length) - videos;
  const days = Math.round((Date.parse(localDay(endsAt, timeZone)) - Date.parse(localDay(startsAt, timeZone))) / DAY) + 1;
  return [
    count(photos, "foto", "fotos"),
    videos > 0 ? count(videos, "video", "videos") : null,
    count(people, "persona", "personas"),
    count(days, "día", "días"),
  ]
    .filter(Boolean)
    .join(" · ");
}
