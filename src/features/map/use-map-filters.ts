import { useCallback, useState } from "react";
import { applyFilterAction, type FilterState } from "@/features/map/filter-menu";

const NONE: FilterState = { today: false, moments: false, authorId: null };

/** The map's filters (today / moments / person), changed from the filter menu or cleared together. */
export function useMapFilters() {
  const [filters, setFilters] = useState<FilterState>(NONE);
  const onAction = useCallback((id: string) => setFilters((f) => applyFilterAction(f, id)), []);
  const clear = useCallback(() => setFilters(NONE), []);
  return { filters, onAction, clear };
}
