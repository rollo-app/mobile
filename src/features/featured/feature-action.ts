/**
 * Whether the "Agregar a tu perfil" / "Sacar de tu perfil" action shows for a photo: always when it is on your
 * profile (you can take it off), otherwise only when the server says you can feature it (`canFeature`).
 * The photos of a daily moment are never offered (an older server may still say yes).
 */
export function featureActionAvailable(photo: { featuredByMe: boolean; canFeature: boolean; momentDay?: string | null }): boolean {
  return photo.featuredByMe || (photo.canFeature && !photo.momentDay);
}
