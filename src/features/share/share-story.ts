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

/** Opens Instagram's Stories editor with the image as the background. */
export async function shareToInstagramStories(uri: string): Promise<void> {
  // The typings expose INSTAGRAM_STORIES as a plain string (it comes from native constants); shareSingle wants the enum member.
  const social = Share.Social.INSTAGRAM_STORIES as Social.InstagramStories;
  await Share.shareSingle({ social, appId: META_APP_ID, backgroundImage: uri });
}

/** The system share sheet ("Más opciones"). */
export async function shareMore(uri: string, message?: string): Promise<void> {
  await SystemShare.share({ url: uri, message });
}

/** react-native-share rejects with this message when the user closes the share flow without sharing. */
export const isShareCancel = (e: unknown): boolean => e instanceof Error && e.message === "User did not share";
