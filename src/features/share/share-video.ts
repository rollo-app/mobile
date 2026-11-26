import { Asset, requestPermissionsAsync } from "expo-media-library";
import { Linking, Share as SystemShare } from "react-native";
import { META_APP_ID } from "@/config";
import { PermissionDeniedError } from "@/features/gallery/save";
import { shareVideoToInstagram } from "../../../modules/rollo-video";

/** The longest film Instagram's Stories route takes whole. */
export const STORIES_DIRECT_MAX_MS = 20_000;
const LIBRARY_URL = "instagram://story-camera";

/** "stories" for a film Instagram's Stories route takes whole, "library" for a longer one (save to Photos, then open Instagram). */
export function instagramRoute(durationMs: number): "stories" | "library" {
  return durationMs <= STORIES_DIRECT_MAX_MS ? "stories" : "library";
}

/** Adds the video to Photos (add-only permission). Throws PermissionDeniedError when it is not granted. */
export async function saveVideo(uri: string): Promise<void> {
  const permission = await requestPermissionsAsync(true);
  if (!permission.granted) throw new PermissionDeniedError(permission.canAskAgain);
  await Asset.create(uri);
}

/** The system share sheet. */
export async function shareVideoMore(uri: string): Promise<void> {
  await SystemShare.share({ url: uri });
}

export async function shareVideoToInstagramApp(uri: string, durationMs: number): Promise<"stories" | "library"> {
  const route = instagramRoute(durationMs);
  if (route === "stories") {
    // false means Instagram could not be opened: the same failure as any other.
    if (!(await shareVideoToInstagram("stories", uri, META_APP_ID))) throw new Error("Instagram could not be opened");
    return route;
  }
  await saveVideo(uri);
  await Linking.openURL(LIBRARY_URL);
  return route;
}
