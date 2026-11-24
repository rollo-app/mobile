import type { Schemas } from "@/api/client";
import type { RollPhase } from "@/features/trips/phase";

/** Past this many finalists the picks screen nudges (the server has no cap). */
export const SUGGESTED_FINALISTS = 15;

/** "1 elegida" / "4 elegidas". */
export const pickCountLabel = (n: number) => `${n} ${n === 1 ? "elegida" : "elegidas"}`;

/** "te sugerimos hasta 15" once past the suggested count; null otherwise. */
export const pickHint = (n: number): string | null => (n > SUGGESTED_FINALISTS ? `te sugerimos hasta ${SUGGESTED_FINALISTS}` : null);

/** Organizers choose the finalists while the contest is in `selecting` (from the end of the event to the reveal). */
export function canPick(contest: Pick<Schemas["Contest"], "status"> | null | undefined, isOrganizer: boolean): boolean {
  return isOrganizer && contest?.status === "selecting";
}

/** The board's "Elegí las finalistas" row: an organizer of an event with a contest, once it ended and until the reveal. */
export function picksRowVisible({ organizer, contestEnabled, phase }: { organizer: boolean; contestEnabled: boolean; phase: RollPhase | null }): boolean {
  return organizer && contestEnabled && phase === "ended";
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "Cierra en 2 días" / "Cierra en 5 h" / "Cierra en 12 min" (never under a minute); empty without a closing time. */
export function countdownLabel(closesAt: number | null, now: number): string {
  if (closesAt === null) return "";
  const left = Math.max(closesAt - now, 0);
  if (left >= DAY) {
    const days = Math.floor(left / DAY);
    return `Cierra en ${days} ${days === 1 ? "día" : "días"}`;
  }
  if (left >= HOUR) return `Cierra en ${Math.floor(left / HOUR)} h`;
  return `Cierra en ${Math.max(Math.ceil(left / MINUTE), 1)} min`;
}

// FNV-1a of the seed, then mulberry32: small, deterministic, no dependencies.
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The finalists in an order that's stable per seed (the viewer's user id), so nobody's photo is always first. */
export function shuffledFinalists<T extends { mediaId: string }>(finalists: readonly T[], seed: string): T[] {
  // Sorted first: the same set shuffles the same whatever order the server sends it in.
  const out = [...finalists].sort((a, b) => (a.mediaId < b.mediaId ? -1 : a.mediaId > b.mediaId ? 1 : 0));
  const random = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** The contest card's line by status; null when there's nothing to show yet (before the voting) or no contest. */
export function cardCopy(contest: Schemas["Contest"] | null | undefined, now: number): string | null {
  if (!contest) return null;
  switch (contest.status) {
    case "voting":
      return `Concurso de fotos · ${countdownLabel(contest.closesAt, now)}`;
    case "closing":
      return "Cerrando la votación…";
    case "tied":
      return "Concurso de fotos · Hay un empate";
    case "closed":
      return contest.winner ? `Ganó la foto de ${contest.winner.author.name}` : null;
    case "cancelled":
      return "El concurso se canceló.";
    default:
      return null;
  }
}

/** Segments in the pager's progress up to 20 finalists (each is wide enough to read); a continuous bar past that. */
export const progressStyle = (count: number): "segments" | "bar" => (count <= 20 ? "segments" : "bar");
