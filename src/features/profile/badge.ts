const LABELS: Record<string, string> = {
  founder: "FOUNDER",
  first_edition: "FIRST EDITION",
};

/** Capsule text for a profile badge the server assigned; null for none or a value this app doesn't know yet. */
export function badgeLabel(badge: string | null | undefined): string | null {
  return badge && Object.hasOwn(LABELS, badge) ? (LABELS[badge] ?? null) : null;
}

/** "FIRST EDITION" -> "First Edition", so VoiceOver reads words instead of spelling capitals. */
export function badgeSpoken(label: string): string {
  return label.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
