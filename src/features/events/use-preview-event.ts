import { useMutation } from "@tanstack/react-query";
import { previewEvent } from "@/features/trips/actions";

/** Looks the code up before joining: the event's preview, or null for a regular trip. */
export function usePreviewEvent() {
  return useMutation({ mutationFn: (code: string) => previewEvent(code) });
}
