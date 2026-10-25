import { Image } from "expo-image";
import type * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErrorText } from "@/ui/components";
import { colors, radius, spacing, type } from "@/ui/theme";

export type Shot = { asset: ImagePicker.ImagePickerAsset; takenAt: number };

// Strong enough that the photo can't be recognized: the shot is the shot, you only get to caption it.
const BLUR_RADIUS = 100;

/** The shot, blurred, with an optional caption. There is no retake or cancel: the only way out is sending it. */
export function CapturePreview(props: {
  shot: Shot;
  caption: string;
  onCaption: (text: string) => void;
  sending: boolean;
  error: string | null;
  onSend: () => void;
}) {
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardOpen();
  // Normal column (no absolute positioning): when the keyboard opens, the controls rise with it
  // and the photo shrinks into the remaining space, instead of being covered.
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.dark, { paddingTop: insets.top }]}>
      <Pressable accessible={false} onPress={Keyboard.dismiss} style={styles.photo}>
        <Image source={{ uri: props.shot.asset.uri }} style={styles.photo} contentFit="cover" blurRadius={BLUR_RADIUS} accessible={false} />
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
  dark: { flex: 1, backgroundColor: "#000" },
  photo: { flex: 1 },
  bottom: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  dim: { color: "rgba(255,255,255,0.75)" },
  caption: { color: "#fff", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: radius.lg, borderCurve: "continuous", paddingHorizontal: 18, minHeight: 50 },
  sendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  note: { flex: 1 },
  send: { backgroundColor: colors.tint, borderRadius: radius.full, paddingHorizontal: 22, minHeight: 52, justifyContent: "center" },
});
