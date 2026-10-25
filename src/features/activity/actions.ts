import { unwrap, type Schemas } from "@/api/client";
import { authedClient } from "@/features/auth/session";

/** A photo you liked and can still open: where to open it, never the roll's name or the caption. */
export type LikedPhoto = Schemas["LikedPhoto"];
export type MyLikes = Schemas["MyLikes"];

/** One page of the photos you liked (the server only sends the ones you can see today), newest like first. */
export async function fetchMyLikes(cursor?: string): Promise<MyLikes> {
  return unwrap((await authedClient()).GET("/me/likes", { params: { query: { cursor } } }));
}
