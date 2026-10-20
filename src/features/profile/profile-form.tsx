import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { meKey, type User } from "@/features/auth/actions";
import { Button, ErrorText, Field, Row, Section } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { updateProfile } from "./actions";
import { Avatar } from "./avatar";
import { useAvatarUpload } from "./use-avatar-upload";
import { USERNAME_TAKEN, useUsernameStatus } from "./use-username-status";
import { normalizeUsername, suggestUsername } from "./username";

/** Photo (optional), name and username (required): used to complete the profile and to edit it. */
export function ProfileForm({
  user,
  submitLabel,
  onSaved,
  showEmail = false,
}: {
  user: User;
  submitLabel: string;
  onSaved: () => void;
  /** Read-only email row at the top (editing, not completing). */
  showEmail?: boolean;
}) {
  const queryClient = useQueryClient();
  const avatar = useAvatarUpload();
  const [name, setName] = useState(user.name ?? "");
  const [username, setUsername] = useState(user.username ?? suggestUsername(user.email));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const trimmed = name.trim();
  const normalized = normalizeUsername(username);
  const status = useUsernameStatus(username, user.username);
  const statusOk = status.kind === "unchanged" || status.kind === "available" || status.kind === "unknown";
  const valid = trimmed.length > 0 && statusOk && !avatar.uploading;

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
      if (trimmed !== user.name || normalized !== user.username) {
        const updated = await updateProfile({ name: trimmed, username: normalized });
        queryClient.setQueryData(meKey, (current: User | undefined) => ({
          ...(current ?? updated),
          name: updated.name,
          username: updated.username,
        }));
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

      {showEmail && (
        <Section footer="Es lo que hace única tu cuenta.">
          <Row label="Email" value={user.email} />
        </Section>
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

      <View style={styles.usernameBlock}>
        <Field
          label="Nombre de usuario"
          prefix="@"
          value={username}
          onChangeText={(value) => {
            setUsername(value);
            setError(null);
          }}
          maxLength={31}
          placeholder="usuario"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          textContentType="username"
          keyboardType="ascii-capable"
        />
        {status.kind === "invalid" && <ErrorText>{status.message}</ErrorText>}
        {status.kind === "taken" && <ErrorText>{USERNAME_TAKEN}</ErrorText>}
        {status.kind === "checking" && <Text style={[type.footnote, styles.status]}>Revisando…</Text>}
        {status.kind === "available" && <Text style={[type.footnote, styles.status]}>Disponible</Text>}
      </View>

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
  usernameBlock: { gap: spacing.xs },
  status: { color: colors.secondaryLabel, paddingHorizontal: spacing.md },
  photoError: { gap: spacing.sm },
});
