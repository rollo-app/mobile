import { File, Paths } from "expo-file-system";
import { Linking, Share as SystemShare } from "react-native";
import Share, { type Social } from "react-native-share";
import { META_APP_ID } from "@/config";

/** Writes the rendered JPEG to the cache (overwriting the previous one) and returns its file:// uri. */
export async function writeStoryFile(bytes: Uint8Array, name: "collage" | "invite"): Promise<string> {
  const file = new File(Paths.cache, `rollo-${name}.jpg`);
  file.create({ overwrite: true });
  await file.write(bytes);
  return file.uri;
}

/** Whether Instagram can take a Story: needs the Meta app id and the app installed (`instagram-stories` scheme). */
export async function instagramStoriesAvailable(appId: string | null = META_APP_ID): Promise<boolean> {
  if (!appId) return false;
  try {
    return await Linking.canOpenURL("instagram-stories://share");
  } catch {
    return false;
  }
}

/**
 * Opens Instagram's Stories editor with the image as the background. On iOS this just opens Instagram and resolves:
 * there is no callback when the editor is closed, so there is no cancel to detect. Real failures reject.
 */
export async function shareToInstagramStories(uri: string): Promise<void> {
  // The typings expose INSTAGRAM_STORIES as a plain string (it comes from native constants); shareSingle wants the enum member.
  const social = Share.Social.INSTAGRAM_STORIES as Social.InstagramStories;
  await Share.shareSingle({ social, appId: META_APP_ID, backgroundImage: uri });
}

/** The system share sheet ("Más opciones"). React Native's Share.share resolves with `dismissedAction` on dismiss and never throws for it. */
export async function shareMore(uri: string, message?: string): Promise<void> {
  await SystemShare.share({ url: uri, message });
}

/**
 * Defensive: react-native-share 12.3.1 throws "User did not share" only from `Share.open()` with `failOnCancel`, which we don't use.
 * Any other rejection is a real error and must surface.
 */
export const isShareCancel = (e: unknown): boolean => e instanceof Error && e.message === "User did not share";
