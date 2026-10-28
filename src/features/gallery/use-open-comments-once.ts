import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import type { RevealedPhoto } from "@/features/media/revealed";

/** The comments push opens the photo with its sheet, once, as soon as the photo is there. */
export function useOpenCommentsOnce(photos: RevealedPhoto[], id: string, openComments: boolean | undefined) {
  const router = useRouter();
  const opened = useRef(false);
  const target = openComments && !opened.current ? photos.find((p) => p.id === id && p.type === "photo") : undefined;
  useEffect(() => {
    if (!target) return;
    opened.current = true;
    router.push({ pathname: "/comments/[mediaId]", params: { mediaId: target.id } });
  }, [target, router]);
}
