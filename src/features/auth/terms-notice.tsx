import { Linking, Text } from "react-native";
import { SITE_URL } from "@/config";
import { Footnote } from "@/ui/components";
import { colors } from "@/ui/theme";

function TermsLink({ path, children }: { path: string; children: string }) {
  return (
    <Text
      accessibilityRole="link"
      style={{ color: colors.tint }}
      onPress={() => void Linking.openURL(`${SITE_URL}${path}`)}
    >
      {children}
    </Text>
  );
}

export function TermsNotice() {
  return (
    <Footnote>
      Al continuar aceptás los <TermsLink path="/terminos">Términos</TermsLink> y la{" "}
      <TermsLink path="/privacidad">Política de privacidad</TermsLink>.
    </Footnote>
  );
}
