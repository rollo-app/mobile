import { unwrap, type Schemas } from "@/api/client";
import { authedClient } from "@/features/auth/session";

/** A photo on someone's profile: no roll, no caption, only a ~5 km zone. */
export type FeaturedPhoto = Schemas["FeaturedPhoto"];

/** Adds a photo of a revealed roll to your profile (idempotent). 409 with the server's message at the cap or if blocked. */
export async function featureMedia(mediaId: string): Promise<void> {
  await unwrap((await authedClient()).PUT("/me/featured/{mediaId}", { params: { path: { mediaId } } }));
}

/** Removes a photo from your profile (idempotent). */
export async function unfeatureMedia(mediaId: string): Promise<void> {
  await unwrap((await authedClient()).DELETE("/me/featured/{mediaId}", { params: { path: { mediaId } } }));
}

/** Author only: others can't feature this photo, and it leaves their profiles. */
export async function blockFeature(mediaId: string): Promise<void> {
  await unwrap((await authedClient()).PUT("/media/{mediaId}/feature-block", { params: { path: { mediaId } } }));
}

/** Author only: others can feature this photo again. */
export async function unblockFeature(mediaId: string): Promise<void> {
  await unwrap((await authedClient()).DELETE("/media/{mediaId}/feature-block", { params: { path: { mediaId } } }));
}

/** A user's featured photos, most recently featured first. 403 "Este perfil es privado" if you can't see them. */
export async function fetchFeatured(userId: string): Promise<FeaturedPhoto[]> {
  const { photos } = await unwrap((await authedClient()).GET("/users/{userId}/featured", { params: { path: { userId } } }));
  return photos;
}

/** Who can feature your photos, account level (on by default). */
export type PrivacySettings = Schemas["PrivacySettings"];

export async function fetchPrivacySettings(): Promise<PrivacySettings> {
  return (await unwrap((await authedClient()).GET("/me/settings"))).privacy;
}

/** Turning `allowFeaturing` off also takes your photos off other profiles; turning it on restores nothing. */
export async function updatePrivacySettings(patch: Partial<PrivacySettings>): Promise<PrivacySettings> {
  return (await unwrap((await authedClient()).PATCH("/me/settings", { body: { privacy: patch } }))).privacy;
}

/** Whether others may feature your photos of this rollo (off takes them off other profiles). */
export async function setMyFeaturing(tripId: string, allowFeaturing: boolean): Promise<void> {
  await unwrap(
    (await authedClient()).PATCH("/trips/{tripId}/members/me", { params: { path: { tripId } }, body: { allowFeaturing } }),
  );
}

/** Admin only: a private rollo's photos can't go to any profile, not even their author's. */
export async function setTripPrivate(tripId: string, featuringDisabled: boolean): Promise<void> {
  await unwrap((await authedClient()).PATCH("/trips/{tripId}", { params: { path: { tripId } }, body: { featuringDisabled } }));
}
