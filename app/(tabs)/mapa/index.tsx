import { Camera, Map, ViewAnnotation } from "@maplibre/maplibre-react-native";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { deleteAllRegions, downloadRegion, toMB, type LngLat } from "@/features/map/offline";
import { OPENFREEMAP_POSITRON } from "@/features/map/style";
import { writeStyleFile } from "@/features/map/style-file";
import { TripSwitcher } from "@/features/trips/trip-switcher";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { Button, ErrorText, Footnote } from "@/ui/components";

const CHALTEN: LngLat = [-72.89, -49.33];

const PINS: { initial: string; lngLat: LngLat; color: string }[] = [
  { initial: "J", lngLat: [-72.89, -49.33], color: "#FF6B35" },
  { initial: "C", lngLat: [-72.93, -49.28], color: "#2E86DE" },
  { initial: "M", lngLat: [-72.83, -49.36], color: "#10AC84" },
];

type StyleChoice = "ofm" | "custom";

export default function MapScreen() {
  const { trip } = useActiveTrip();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const [choice, setChoice] = useState<StyleChoice>("custom");
  const [customUri, setCustomUri] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setCustomUri(writeStyleFile(scheme));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [scheme]);

  const mapStyle = choice === "ofm" ? OPENFREEMAP_POSITRON : customUri;

  async function download() {
    if (!mapStyle) return;
    setError(null);
    setResult(null);
    setProgress(0);
    const started = Date.now();
    try {
      const status = await downloadRegion(mapStyle, CHALTEN, 40, 10, 14, (s) => setProgress(s.percentage));
      const secs = Math.round((Date.now() - started) / 1000);
      setResult(`${toMB(status.completedResourceSize).toFixed(1)} MB · ${status.completedTileCount} tiles · ${secs} s`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  }

  async function clear() {
    setError(null);
    try {
      const n = await deleteAllRegions();
      setResult(`${n} zonas borradas`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <View style={styles.fill}>
      {trip && <Stack.Screen options={{ headerTitle: () => <TripSwitcher name={trip.tripName} /> }} />}
      {mapStyle && (
        <Map key={mapStyle} style={styles.fill} mapStyle={mapStyle} logo={false} compass={false}>
          <Camera initialViewState={{ center: CHALTEN, zoom: 11 }} />
          {PINS.map((pin) => (
            <ViewAnnotation key={pin.initial} id={pin.initial} lngLat={pin.lngLat}>
              <View style={[styles.pin, { backgroundColor: pin.color }]}>
                <Text style={styles.pinText}>{pin.initial}</Text>
              </View>
            </ViewAnnotation>
          ))}
        </Map>
      )}
      {/* Controles temporales de la prueba técnica */}
      <View style={styles.panel}>
        <Button
          variant="secondary"
          label={choice === "ofm" ? "Estilo: OpenFreeMap (positron)" : "Estilo: propio"}
          onPress={() => setChoice((c) => (c === "ofm" ? "custom" : "ofm"))}
        />
        <Button
          label={progress === null ? "Bajar zona (prueba)" : `Bajando… ${Math.round(progress)} %`}
          loading={progress !== null}
          onPress={download}
        />
        <Button variant="secondary" label="Borrar zonas" onPress={clear} />
        {result && <Footnote>{result}</Footnote>}
        {error && <ErrorText>{error}</ErrorText>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  pinText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  panel: { position: "absolute", left: 16, right: 16, bottom: 100, gap: 8 },
});
