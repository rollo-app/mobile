import type { Href } from "expo-router";
import type { FeaturedByItem, MyComment } from "./actions";

/** Your comment's photo in the roll's gallery, with the comments open. */
export const commentHref = (c: MyComment): Href => `/photo/${c.mediaId}?tripId=${c.tripId}&comments=1`;

/** The photo where it is featured: on the profile of whoever featured it. */
export const featuredByHref = (item: FeaturedByItem): Href => `/featured/${item.user.id}/${item.mediaId}`;
