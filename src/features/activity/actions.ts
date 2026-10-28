import { unwrap, type Schemas } from "@/api/client";
import { authedClient } from "@/features/auth/session";

/** A photo you liked and can still open: where to open it, never the roll's name or the caption. */
export type LikedPhoto = Schemas["LikedPhoto"];
export type MyLikes = Schemas["MyLikes"];
export type MyComment = Schemas["MyComment"];
export type MyComments = Schemas["MyComments"];
export type FeaturedByItem = Schemas["FeaturedByItem"];
export type FeaturedByList = Schemas["FeaturedByList"];

/** One page of your comments on photos you can still open, newest first. */
export async function fetchMyComments(cursor?: string): Promise<MyComments> {
  return unwrap((await authedClient()).GET("/me/comments", { params: { query: { cursor } } }));
}

/** One page of the people who featured one of your photos on their profile (only the ones you can see), newest first. */
export async function fetchFeaturedBy(cursor?: string): Promise<FeaturedByList> {
  return unwrap((await authedClient()).GET("/me/featured-by", { params: { query: { cursor } } }));
}

/** One page of the photos you liked (the server only sends the ones you can see today), newest like first. */
export async function fetchMyLikes(cursor?: string): Promise<MyLikes> {
  return unwrap((await authedClient()).GET("/me/likes", { params: { query: { cursor } } }));
}
