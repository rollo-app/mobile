import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { meKey, type User } from "@/features/auth/actions";
import { stashFriendCode } from "@/features/friends/handle-friend-link";
import { Button, ErrorText, Field, Row, Section } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { updateProfile } from "./actions";
import { Avatar } from "./avatar";
import { useAvatarUpload } from "./use-avatar-upload";
import { USERNAME_TAKEN, useUsernameStatus } from "./use-username-status";
import { normalizeUsername, suggestUsername } from "./username";

/** Same limit as the server; it counts what JS counts (`String.length`). */
const BIO_MAX = 150;

/** Photo (optional), name and username (required), and the description when editing: completes or edits the profile. */
export function ProfileForm({
  user,
  submitLabel,
  onSaved,
  showEmail = false,
  askFriendCode = false,
  showBio = false,
}: {
  user: User;
  submitLabel: string;
  onSaved: () => void;
  /** Read-only email row at the top (editing, not completing). */
  showEmail?: boolean;
  /** Optional "¿Te invitó un amigo?" code, only when signing up. */
  askFriendCode?: boolean;
  /** Optional "Descripción", only when editing (not when completing the profile). */
  showBio?: boolean;
}) {
  const queryClient = useQueryClient();
  const avatar = useAvatarUpload();
  const [name, setName] = useState(user.name ?? "");
  const [username, setUsername] = useState(user.username ?? suggestUsername(user.email));
  const [bio, setBio] = useState(user.bio ?? "");
  const [friendCode, setFriendCode] = useState("");
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
      // A wrong code is told here, before saving: the friendship itself is made once the profile is done.
      if (askFriendCode && friendCode.trim()) await stashFriendCode(friendCode);
      const bioChanged = showBio && bio !== (user.bio ?? "");
      if (trimmed !== user.name || normalized !== user.username || bioChanged) {
        const updated = await updateProfile({ name: trimmed, username: normalized, ...(bioChanged ? { bio } : {}) });
        queryClient.setQueryData(meKey, (current: User | undefined) => ({
          ...(current ?? updated),
          name: updated.name,
          username: updated.username,
          bio: updated.bio,
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

      {showBio && (
        <View style={styles.bioBlock}>
          <Field
            label="Descripción"
            value={bio}
            onChangeText={(value) => {
              setBio(value);
              setError(null);
            }}
            maxLength={BIO_MAX}
            multiline
            placeholder="Opcional"
            style={styles.bio}
          />
          <Text style={[type.footnote, styles.counter]}>{`${bio.length}/${BIO_MAX}`}</Text>
        </View>
      )}

      {askFriendCode && (
        <Field
          label="¿Te invitó un amigo? Código"
          value={friendCode}
          onChangeText={(value) => {
            setFriendCode(value);
            setError(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          placeholder="Opcional"
        />
      )}

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
  bioBlock: { gap: spacing.xs },
  bio: { minHeight: 88, paddingTop: 14, paddingBottom: 14, textAlignVertical: "top" },
  counter: { color: colors.secondaryLabel, paddingHorizontal: spacing.md, textAlign: "right" },
  status: { color: colors.secondaryLabel, paddingHorizontal: spacing.md },
  photoError: { gap: spacing.sm },
});
