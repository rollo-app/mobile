import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { mediaSource, type RevealedPhoto } from "@/features/media/revealed";
import { spacing, type } from "@/ui/theme";
import { sampleEvenly } from "./upcoming";

const COLUMNS = 5;
const MAX_CELLS = 30;
const GAP = 2;
/** Cells sharpen one after another between these two moments. */
const FIRST_MS = 300;
const SPREAD_MS = 2200;
const TITLE_AT_MS = 3200;

/**
 * The reveal: the mosaic of blurry ThumbHash colors (what the contact sheet showed) sharpens cell by
 * cell into the real thumbs, then fades to the roll's title. With "Reducir movimiento" every cell
 * simply cross-fades at once.
 */
export function Intro({
  photos,
  token,
  title,
  date,
  reduceMotion,
}: {
  photos: RevealedPhoto[];
  token: string;
  title: string;
  date: string;
  reduceMotion: boolean;
}) {
  const { width } = useWindowDimensions();
  const cells = sampleEvenly(photos, MAX_CELLS);
  const size = (width - GAP * (COLUMNS - 1)) / COLUMNS;

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const gridOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const fade = Animated.parallel([
      Animated.timing(titleOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(gridOpacity, { toValue: 0.25, duration: 700, useNativeDriver: true }),
    ]);
    const id = setTimeout(() => fade.start(), TITLE_AT_MS);
    return () => {
      clearTimeout(id);
      fade.stop();
    };
  }, [titleOpacity, gridOpacity]);

  return (
    <View style={styles.fill} accessible accessibilityLabel={`${title}. Se reveló el ${date}.`}>
      <Animated.View style={[styles.grid, { opacity: gridOpacity }]}>
        {cells.map((photo, i) => (
          <Cell
            key={photo.id}
            photo={photo}
            token={token}
            size={size}
            delay={reduceMotion ? FIRST_MS : FIRST_MS + (i * SPREAD_MS) / cells.length}
            duration={reduceMotion ? 800 : 500}
          />
        ))}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.titleBox, { opacity: titleOpacity }]}>
        <Text style={styles.kicker}>Se reveló</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.date}>{date}</Text>
      </Animated.View>
    </View>
  );
}

function Cell({
  photo,
  token,
  size,
  delay,
  duration,
}: {
  photo: RevealedPhoto;
  token: string;
  size: number;
  delay: number;
  duration: number;
}) {
  const [sharp, setSharp] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSharp(true), delay);
    return () => clearTimeout(id);
  }, [delay]);
  const placeholder = photo.thumbhash ? { thumbhash: photo.thumbhash } : undefined;
  return (
    <Image
      style={{ width: size, height: size, backgroundColor: "#1c1c1e" }}
      contentFit="cover"
      recyclingKey={photo.id}
      placeholder={placeholder}
      placeholderContentFit="cover"
      source={sharp || !placeholder ? mediaSource(photo.thumbPath, token) : placeholder}
      transition={{ duration, effect: "cross-dissolve" }}
      accessible={false}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, justifyContent: "center" },
  titleBox: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  kicker: { ...type.subhead, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: 1.5 },
  title: { ...type.largeTitle, color: "#fff", textAlign: "center" },
  date: { ...type.body, color: "rgba(255,255,255,0.75)" },
});
