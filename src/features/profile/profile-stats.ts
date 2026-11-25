export type ProfileStatsInput = {
  /** undefined/null → not shown */
  rolls?: number | null;
  photos?: number | null;
  friends: number;
  /** Someone else's profile only. */
  mutual?: number;
  canSee?: boolean;
  own?: boolean;
};

export type StatPart = { kind: "rolls" | "photos" | "friends"; count: string; word: string };

/** Thousands with a dot ("1.284"); manual because CLDR "es" skips the separator on 4 digits. */
export function formatCount(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function part(kind: StatPart["kind"], n: number, singular: string, plural: string): StatPart {
  return { kind, count: formatCount(n), word: n === 1 ? singular : plural };
}

/** The numbers line parts, in order: rolls, photos, friends. Zeros and hidden numbers are left out. */
export function statParts({ rolls, photos, friends, mutual = 0, canSee = true }: ProfileStatsInput): StatPart[] {
  const parts: StatPart[] = [];
  if (canSee && rolls) parts.push(part("rolls", rolls, "rollo", "rollos"));
  if (canSee && photos) parts.push(part("photos", photos, "foto", "fotos"));
  // A hidden friends list with none in common shows nothing.
  if (friends > 0 && (canSee || mutual > 0)) parts.push(part("friends", friends, "amigo", "amigos"));
  return parts;
}

/** Own profile with nothing to count at all. */
export function emptyStatsText(input: ProfileStatsInput): string | null {
  if (!input.own || statParts(input).length > 0) return null;
  return input.friends === 0 ? "Todavía no tenés amigos" : null;
}

export function mutualText(mutual: number | undefined): string | null {
  if (!mutual || mutual <= 0) return null;
  return `${formatCount(mutual)} ${mutual === 1 ? "amigo" : "amigos"} en común`;
}

/** Screen-reader phrase: "8 rollos, 34 fotos, 12 amigos". */
export function spokenStats(parts: StatPart[]): string {
  return parts.map((p) => `${p.count} ${p.word}`).join(", ");
}
