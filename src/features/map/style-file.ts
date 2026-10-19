import { Directory, File, Paths } from "expo-file-system";
import { buildMapStyle, type MapScheme } from "./style";

/**
 * El estilo propio se guarda como archivo y se usa por `file://` tanto en el mapa como en las
 * descargas offline: en iOS `OfflineManager.createPack` hace `NSURL URLWithString(mapStyle)`, así
 * que un JSON en línea daría una URL nula.
 */
export function writeStyleFile(scheme: MapScheme): string {
  const dir = new Directory(Paths.document, "map");
  if (!dir.exists) dir.create();
  const file = new File(dir, `style-${scheme}.json`);
  file.create({ overwrite: true });
  file.write(JSON.stringify(buildMapStyle(scheme)));
  return file.uri;
}
