import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CapturedPhoto } from "@/features/camera/captured-photo";
import { ErrorText } from "@/ui/components";
import { insetFrame } from "@/ui/inset-frame";
import { colors, radius, spacing, type } from "@/ui/theme";

export type Shot = { photo: CapturedPhoto; takenAt: number };

// Strong enough that the photo can't be recognized: the shot is the shot, you only get to caption it.
const BLUR_RADIUS = 100;

/**
 * The shot, blurred, with an optional caption. No retake: the X only discards it (after a native confirmation), so a
 * user who doesn't want it doesn't have to kill the app.
 */
export function CapturePreview(props: {
  shot: Shot;
  caption: string;
  onCaption: (text: string) => void;
  sending: boolean;
  error: string | null;
  onSend: () => void;
  /** Discard the shot (after the confirmation): delete its files and close. */
  onDiscard: () => void;
  /** The moment's second shot: also blurred, in the top-left corner like the viewers' inset (only visual, no swapping). */
  inset?: CapturedPhoto | null;
}) {
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardOpen();
  // Normal column (no absolute positioning): when the keyboard opens, the controls rise with it
  // and the photo shrinks into the remaining space, instead of being covered.
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.dark, { paddingTop: insets.top }]}>
      <Pressable accessible={false} onPress={Keyboard.dismiss} style={styles.photo}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Descartar foto"
          disabled={props.sending}
          hitSlop={6}
          onPress={() =>
            Alert.alert("¿Descartar la foto?", "No se sube al rollo y no se puede recuperar.", [
              { text: "Cancelar", style: "cancel" },
              { text: "Descartar", style: "destructive", onPress: props.onDiscard },
            ])
          }
          style={styles.discard}
        >
          <SymbolView name="xmark" size={16} tintColor="#fff" />
        </Pressable>
        <Image source={{ uri: props.shot.photo.uri }} style={styles.photo} contentFit="cover" blurRadius={BLUR_RADIUS} accessible={false} />
        {props.inset && (
          <View testID="caption-inset" style={[insetFrame.frame, styles.inset, { top: spacing.sm + 44 }]}>
            <Image
              testID="caption-inset-image"
              source={{ uri: props.inset.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              blurRadius={BLUR_RADIUS}
              accessible={false}
            />
          </View>
        )}
      </Pressable>

      <View style={[styles.bottom, { paddingBottom: keyboardOpen ? spacing.sm : insets.bottom + spacing.md }]}>
        <TextInput
          accessibilityLabel="Caption"
          placeholder="Agregá un caption"
          placeholderTextColor="rgba(255,255,255,0.55)"
          value={props.caption}
          onChangeText={props.onCaption}
          maxLength={140}
          editable={!props.sending}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          style={[type.body, styles.caption]}
        />
        {props.error && <ErrorText>{props.error}</ErrorText>}
        <View style={styles.sendRow}>
          <Text style={[type.footnote, styles.dim, styles.note]}>Después de mandarla no la ves hasta el revelado</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mandar al rollo"
            accessibilityState={{ busy: props.sending, disabled: props.sending }}
            disabled={props.sending}
            onPress={props.onSend}
            style={({ pressed }) => [styles.send, { opacity: props.sending ? 0.6 : pressed ? 0.8 : 1 }]}
          >
            <Text style={[type.headline, { color: colors.onTint }]}>{props.sending ? "Guardando…" : "Mandar al rollo"}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Whether the keyboard is open (to avoid adding the screen's bottom margin on top of the keyboard). */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", () => setOpen(true));
    const hide = Keyboard.addListener("keyboardWillHide", () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

// The preview is always dark, like the camera: the photo takes the lead.
const styles = StyleSheet.create({
  discard: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.md,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  dark: { flex: 1, backgroundColor: "#000" },
  photo: { flex: 1 },
  inset: { position: "absolute", left: spacing.md },
  bottom: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  dim: { color: "rgba(255,255,255,0.75)" },
  caption: { color: "#fff", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: radius.lg, borderCurve: "continuous", paddingHorizontal: 18, minHeight: 50 },
  sendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  note: { flex: 1 },
  send: { backgroundColor: colors.tint, borderRadius: radius.full, paddingHorizontal: 22, minHeight: 52, justifyContent: "center" },
});
