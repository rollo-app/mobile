import { Asset } from "expo-asset";

/** A bundled asset (a `require(...)` module number) as a local file uri, downloading it first if needed (dev serves it from Metro). */
export async function assetUri(module: number): Promise<string> {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error("no asset uri");
  return uri;
}
