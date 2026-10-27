import { useEffect, useState } from "react";
import { loadCameraGrid, saveCameraGrid } from "@/storage/camera-grid";

/** The rule-of-thirds grid: a phone setting, remembered between openings. */
export function useCameraGrid() {
  const [grid, setGrid] = useState(false);

  useEffect(() => {
    let live = true;
    loadCameraGrid()
      .then((on) => {
        if (live && on) setGrid(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  function toggleGrid() {
    const next = !grid;
    setGrid(next);
    saveCameraGrid(next).catch(() => {});
  }

  return { grid, toggleGrid };
}
