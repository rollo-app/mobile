/** What the map's filter menu has on: only today's photos, only daily moments and/or one person's. */
export type MapFilters = { today: boolean; moments?: boolean; authorName: string | null };

/** Text on the filter pill: "Filtros" when nothing is on, otherwise what is filtering. */
export function filterLabel(f: MapFilters): string {
  const parts = [f.today ? "Hoy" : null, f.moments ? "Momentos" : null, f.authorName].filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join(" · ") : "Filtros";
}

/** Whether any filter is on (the pill goes cobalt). */
export function filterActive(f: MapFilters): boolean {
  return f.today || !!f.moments || f.authorName !== null;
}
