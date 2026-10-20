declare module "piexifjs" {
  type Rational = [number, number];
  type Tags = Record<number, string | number | Rational | Rational[] | number[]>;
  export type ExifDict = { "0th": Tags; Exif: Tags; GPS: Tags; Interop?: Tags; "1st"?: Tags; thumbnail?: string | null };
  const piexif: {
    ImageIFD: { Software: number; DateTime: number; ImageDescription: number; Artist: number };
    ExifIFD: { DateTimeOriginal: number; DateTimeDigitized: number };
    GPSIFD: {
      GPSVersionID: number;
      GPSLatitudeRef: number;
      GPSLatitude: number;
      GPSLongitudeRef: number;
      GPSLongitude: number;
      GPSTimeStamp: number;
      GPSDateStamp: number;
      GPSHPositioningError: number;
    };
    GPSHelper: {
      degToDmsRational(deg: number): Rational[];
      dmsRationalToDeg(dms: Rational[], ref: string): number;
    };
    TAGS: Record<string, Record<number, { name: string; type: string }>>;
    dump(dict: ExifDict): string;
    load(jpeg: string): ExifDict;
    insert(exif: string, jpeg: string): string;
    remove(jpeg: string): string;
  };
  export default piexif;
}
