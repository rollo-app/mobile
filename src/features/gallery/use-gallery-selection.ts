import { useCallback, useState } from "react";
import type { RevealedPhoto } from "@/features/media/revealed";

/** Multi-select mode of the grid. `shown` are the photos "select all" applies to. */
export function useGallerySelection(shown: RevealedPhoto[]) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const allSelected = shown.length > 0 && shown.every((p) => selected.has(p.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(shown.map((p) => p.id)));

  const start = () => setSelecting(true);
  const stop = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  return { selecting, selected, allSelected, toggle, toggleAll, start, stop };
}
