// The "Recorrido" piece of Compartir: the route as a video or as a still poster, chosen with a small control under the preview.
import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { useState } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import type { RevealedPhoto } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";
import { tintHex } from "@/ui/theme";
import { FilmShare } from "./journey-share";
import { PosterShare } from "./poster-share";

type Format = "video" | "poster";
const FORMAT_LABEL: Record<Format, string> = { video: "Video", poster: "Afiche" };
const FORMATS: Format[] = ["video", "poster"];

/**
 * Renders exactly one of the video or the poster (keyed, so switching unmounts the other and cancels a running export).
 * `video` / `poster`: which formats this roll has; the control shows only when both exist.
 */
export function RouteShare({
  tripId,
  detail,
  candidates,
  selection,
  token,
  seed,
  instagram,
  whatsapp,
  video,
  poster,
}: {
  tripId: string;
  detail: TripDetail;
  /** `filmCandidates` of the roll. */
  candidates: RevealedPhoto[];
  selection: readonly string[];
  token: string | null;
  seed: number;
  instagram: boolean;
  whatsapp: boolean;
  video: boolean;
  poster: boolean;
}) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const [chosen, setChosen] = useState<Format>(video ? "video" : "poster");
  // A format that is no longer offered falls back to the other one.
  const format: Format = chosen === "video" ? (video ? "video" : "poster") : poster ? "poster" : "video";
  const control =
    video && poster ? (
      <View style={styles.control}>
        <SegmentedControl
          values={FORMATS.map((f) => FORMAT_LABEL[f])}
          tintColor={tintHex[scheme]}
          selectedIndex={FORMATS.indexOf(format)}
          onValueChange={(v) => setChosen(FORMATS.find((f) => FORMAT_LABEL[f] === v) ?? "video")}
        />
      </View>
    ) : null;

  return format === "video" ? (
    <FilmShare key="video" kind="route" tripId={tripId} detail={detail} candidates={candidates} selection={selection} token={token} seed={seed} instagram={instagram} accessory={control} />
  ) : (
    <PosterShare key="poster" tripId={tripId} detail={detail} candidates={candidates} selection={selection} token={token} instagram={instagram} whatsapp={whatsapp} accessory={control} />
  );
}

const styles = StyleSheet.create({
  control: { width: 200, alignSelf: "center" },
});
