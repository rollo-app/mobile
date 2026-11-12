import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { errorMessage } from "@/api/client";
import { SITE_URL } from "@/config";
import { isValidEmail } from "@/features/auth/email";
import { Button, ErrorText, Field } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { useJoinWaitlist } from "./use-join-waitlist";

const CONSENT = "Acepto que me escriban para avisarme cuando Rollo abra.";
const CHECKBOX_SIZE = 22;

/** Email + consent to join the waitlist. On success the form is replaced by the confirmation and stays that way. */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const join = useJoinWaitlist();
  const ready = isValidEmail(email) && consent;

  if (join.isSuccess) {
    return (
      <Text accessibilityRole="alert" style={[type.headline, styles.center, { color: colors.label }]}>
        ¡Listo! Te mandamos un mail para confirmar.
      </Text>
    );
  }

  const submit = () => join.mutate(email);
  return (
    <View style={styles.form}>
      <Field
        label="Email"
        hideLabel
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="go"
        onSubmitEditing={ready ? submit : undefined}
        placeholder="Tu email"
      />
      {/* The whole row toggles, except the inline link (its own press wins). */}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={CONSENT}
        accessibilityState={{ checked: consent }}
        onPress={() => setConsent((c) => !c)}
        style={styles.consent}
      >
        <SymbolView
          name={consent ? "checkmark.circle.fill" : "circle"}
          size={CHECKBOX_SIZE}
          tintColor={(consent ? colors.tint : colors.tertiaryLabel) as string}
        />
        <Text style={[type.footnote, styles.consentText, { color: colors.secondaryLabel }]}>
          {CONSENT}{" "}
          <Text accessibilityRole="link" style={{ color: colors.tint }} onPress={() => void Linking.openURL(`${SITE_URL}/privacy`)}>
            Ver política de privacidad
          </Text>
        </Text>
      </Pressable>
      {join.error && <ErrorText>{errorMessage(join.error, "No pudimos anotarte")}</ErrorText>}
      <Button label="Avisarme" onPress={submit} disabled={!ready} loading={join.isPending} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  center: { textAlign: "center" },
  consent: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  consentText: { flex: 1 },
});
