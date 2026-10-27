import type { MenuAction } from "@expo/ui/community/menu";
import type { RevealedPhoto } from "@/features/media/revealed";
import { ownPhotoActions } from "./own-photo-actions";

/**
 * The viewer's "…" options. Someone else's photo can be reported; on your own photo you decide whether others may
 * feature it (never a moment's) and, once revealed, archive or delete it. Empty without a photo or an account.
 */
export function viewerMenu({
  photo,
  meId,
  revealed,
  blocking,
}: {
  photo: RevealedPhoto | undefined;
  meId: string | undefined;
  revealed: boolean;
  blocking: boolean;
}): MenuAction[] {
  if (!photo || !meId) return [];
  if (photo.authorUserId !== meId) return [{ id: "report", title: "Denunciar", image: "exclamationmark.bubble" }];
  return [
    ...(photo.type === "photo" && !photo.momentDay // moment photos can never be featured
      ? [
          {
            id: photo.featureBlocked ? "unblock" : "block",
            title: photo.featureBlocked ? "Dejar que la destaquen" : "No dejar que la destaquen",
            image: photo.featureBlocked ? "star" : "star.slash",
            attributes: { disabled: blocking },
          } as MenuAction,
        ]
      : []),
    // Your own photos and videos, once revealed: archive (only you keep seeing it) or delete for good.
    ...(revealed ? ownPhotoActions(photo) : []),
  ];
}
