/**
 * Whether the "Agregar a tu perfil" / "Sacar de tu perfil" action shows for a photo: always when it is on your
 * profile (you can take it off), otherwise only when the server says you can feature it (`canFeature`).
 * The photos of a daily moment are never offered (an older server may still say yes), nor an archived photo
 * (archiving took it off every profile; it has to be unarchived first).
 */
export function featureActionAvailable(photo: {
  featuredByMe: boolean;
  canFeature: boolean;
  momentDay?: string | null;
  archived?: boolean;
}): boolean {
  if (photo.archived) return false;
  return photo.featuredByMe || (photo.canFeature && !photo.momentDay);
}
