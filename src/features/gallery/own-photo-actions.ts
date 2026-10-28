import type { MenuAction } from "@expo/ui/community/menu";

/** "Archivar" / "Desarchivar" and "Eliminar" on your own revealed photo (the viewer's "…" and the grid's long press). */
export function ownPhotoActions(photo: { archived: boolean }): MenuAction[] {
  return [
    photo.archived
      ? { id: "unarchive", title: "Desarchivar", image: "archivebox.fill" }
      : { id: "archive", title: "Archivar", image: "archivebox" },
    { id: "delete", title: "Eliminar", image: "trash", attributes: { destructive: true } },
  ];
}
