import { File, Paths } from "expo-file-system";
import { Linking, Share as SystemShare } from "react-native";
import Share, { type Social } from "react-native-share";
import { META_APP_ID } from "@/config";

/** Writes rendered bytes to the cache as `name` (extension included; overwrites the previous file) and returns its file:// uri. */
export async function writeShareFile(bytes: Uint8Array, name: string): Promise<string> {
  const file = new File(Paths.cache, name);
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

export type InstagramStoriesInput = {
  /** The card (PNG with transparent corners): Instagram puts it on top as a sticker. */
  stickerUri: string;
  /** The style's looping background video. */
  backgroundVideoUri: string;
  /** The style's `base` color: the edges while (or if) the video doesn't load. */
  backgroundColor: string;
  linkText?: string;
};

/**
 * Opens Instagram's Stories editor with a looping background video and the card as a sticker. On iOS this just opens Instagram
 * and resolves: there is no callback when the editor is closed, so there is no cancel to detect. Real failures reject.
 */
export async function shareToInstagramStories({ stickerUri, backgroundVideoUri, backgroundColor, linkText }: InstagramStoriesInput): Promise<void> {
  // The typings expose INSTAGRAM_STORIES as a plain string (it comes from native constants); shareSingle wants the enum member.
  const social = Share.Social.INSTAGRAM_STORIES as Social.InstagramStories;
  // `linkText` also goes in Instagram's pasteboard item as plain text (patches/react-native-share+*.patch): the module replaces the
  // whole general pasteboard, so a link copied before would be lost.
  await Share.shareSingle({
    social,
    appId: META_APP_ID,
    stickerImage: stickerUri,
    backgroundVideo: backgroundVideoUri,
    backgroundTopColor: backgroundColor,
    backgroundBottomColor: backgroundColor,
    ...(linkText ? { linkText } : {}),
  });
}

/** Opens Instagram's Stories editor with the image as the full-screen background and nothing on top (the poster). */
export async function shareImageToInstagramStories(imageUri: string): Promise<void> {
  const social = Share.Social.INSTAGRAM_STORIES as Social.InstagramStories;
  await Share.shareSingle({ social, appId: META_APP_ID, backgroundImage: imageUri });
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

/** Whether WhatsApp is installed (`whatsapp` scheme in LSApplicationQueriesSchemes). */
export async function whatsAppAvailable(): Promise<boolean> {
  try {
    return await Linking.canOpenURL("whatsapp://send");
  } catch {
    return false;
  }
}

/**
 * Opens WhatsApp's chat picker with `text` ready to send. Used for the invitation: plain text with the join link, so WhatsApp
 * draws the link's own preview (the site's per-roll card) instead of getting an image.
 */
export async function shareTextToWhatsApp(text: string): Promise<void> {
  await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`);
}

const WHATSAPP_TIMEOUT_MS = 15_000;

/**
 * Sends the image to WhatsApp (status or chat) through iOS's "Open in" menu. react-native-share writes the temp file as `image.wai`
 * (patches/react-native-share+*.patch) with UTI `net.whatsapp.image`: WhatsApp's own extension makes the menu list only WhatsApp,
 * where a `.jpg` would list every app that opens images. Real failures reject.
 */
export async function shareImageToWhatsApp(uri: string): Promise<void> {
  // Same as INSTAGRAM_STORIES: the typings expose the constant as a plain string; shareSingle wants the enum member.
  const social = Share.Social.WHATSAPP as Social.Whatsapp;
  // `message` must be present (even empty): WhatsAppShare.m `shareSingle` returns early without resolving or rejecting otherwise.
  const send = Share.shareSingle({ social, url: uri, type: "image/jpeg", message: "" });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("WhatsApp share timeout")), WHATSAPP_TIMEOUT_MS);
  });
  try {
    await Promise.race([send, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
