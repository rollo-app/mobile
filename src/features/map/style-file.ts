import { Directory, File, Paths } from "expo-file-system";
import { buildMapStyle, type MapScheme } from "./style";

/**
 * The custom style is saved as a file and used via `file://` both in the map and in
 * offline downloads: on iOS `OfflineManager.createPack` calls `NSURL URLWithString(mapStyle)`, so
 * inline JSON would yield a null URL.
 */
export function writeStyleFile(scheme: MapScheme): string {
  const dir = new Directory(Paths.document, "map");
  if (!dir.exists) dir.create();
  const file = new File(dir, `style-${scheme}.json`);
  file.create({ overwrite: true });
  file.write(JSON.stringify(buildMapStyle(scheme)));
  return file.uri;
}
