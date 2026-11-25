/** Href of a roll's own screen (the Rollos list pushes into it). */
export function rollHref(tripId: string, view?: "gallery" | "roll") {
  return { pathname: "/roll/[tripId]" as const, params: view ? { tripId, view } : { tripId } };
}
