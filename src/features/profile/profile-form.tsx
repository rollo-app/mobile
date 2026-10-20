import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { meKey, type User } from "@/features/auth/actions";
import { Button, ErrorText, Field } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { updateName } from "./actions";
import { Avatar } from "./avatar";
import { useAvatarUpload } from "./use-avatar-upload";

/** Photo (optional) and name (required): used to complete the profile and to edit it. */
export function ProfileForm({ user, submitLabel, onSaved }: { user: User; submitLabel: string; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const avatar = useAvatarUpload();
  const [name, setName] = useState(user.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const trimmed = name.trim();
  const valid = trimmed.length > 0 && !avatar.uploading;

  function choosePhoto() {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ["Sacar foto", "Elegir de la fototeca", "Cancelar"], cancelButtonIndex: 2 },
      (index) => {
        if (index === 0) void avatar.pick("camera");
        if (index === 1) void avatar.pick("library");
      },
    );
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      if (trimmed !== user.name) {
        const updated = await updateName(trimmed);
        queryClient.setQueryData(meKey, (current: User | undefined) => ({ ...(current ?? updated), name: updated.name }));
        void queryClient.invalidateQueries({ queryKey: ["trip"] });
        void queryClient.invalidateQueries({ queryKey: ["feed"] });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el perfil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Foto de perfil"
        onPress={choosePhoto}
        disabled={avatar.uploading}
        style={({ pressed }) => [styles.photo, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Avatar id={user.id} name={trimmed || user.name} avatarUrl={user.avatarUrl} size={72} localUri={avatar.localUri} />
        {avatar.uploading && (
          <View style={styles.spinner}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        )}
        <Text style={[type.subhead, { color: colors.tint }]}>{user.avatarUrl || avatar.localUri ? "Cambiar foto" : "Agregar foto"}</Text>
      </Pressable>
      {avatar.error && (
        <View style={styles.photoError}>
          <ErrorText>{avatar.error}</ErrorText>
          {avatar.localUri && <Button label="Reintentar" variant="secondary" onPress={() => void avatar.retry()} />}
        </View>
      )}

      <Field
        label="Tu nombre"
        value={name}
        onChangeText={setName}
        maxLength={30}
        placeholder="Como te conocen"
        textContentType="name"
        autoComplete="name"
      />

      {error && <ErrorText>{error}</ErrorText>}

      <Button label={submitLabel} onPress={save} disabled={!valid} loading={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  photo: { alignItems: "center", gap: spacing.sm },
  spinner: {
    position: "absolute",
    top: 0,
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  photoError: { gap: spacing.sm },
});
