/**
 * Whether the "Agregar a tu perfil" / "Sacar de tu perfil" action shows for a photo: always when it is on your
 * profile (you can take it off), otherwise only when the server says you can feature it (`canFeature`).
 */
export function featureActionAvailable(photo: { featuredByMe: boolean; canFeature: boolean }): boolean {
  return photo.featuredByMe || photo.canFeature;
}
