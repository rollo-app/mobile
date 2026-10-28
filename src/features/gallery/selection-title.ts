/** Header title while selecting photos in the gallery: short enough to fit between "Seleccionar todo" and "Cancelar". */
export function selectionTitle(count: number): string {
  if (count === 0) return "Seleccioná fotos";
  return count === 1 ? "1 seleccionada" : `${count} seleccionadas`;
}
