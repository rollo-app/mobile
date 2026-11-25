import { SymbolView } from "expo-symbols";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "@/ui/theme";

const GLYPH = 18;
const HEIGHT = 40;
const INSTAGRAM_WHITE = require("../../../assets/share/instagram-white.png");
const WHATSAPP = require("../../../assets/share/whatsapp.png");

function Pill({ label, primary, logo, symbol, disabled, onPress }: { label: string; primary?: boolean; logo?: "instagram" | "whatsapp"; symbol?: "link"; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={disabled ? { disabled: true } : undefined}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, primary ? styles.primary : styles.secondary, disabled && styles.disabled, pressed && styles.pressed]}
    >
      {logo === "instagram" && <Image testID="instagram-logo" source={INSTAGRAM_WHITE} style={styles.glyph} accessible={false} />}
      {logo === "whatsapp" && <Image testID="whatsapp-logo" source={WHATSAPP} style={styles.glyph} accessible={false} />}
      {symbol && <SymbolView name={symbol} size={GLYPH - 2} weight="semibold" tintColor={colors.label as string} />}
      <Text numberOfLines={1} style={[type.footnote, styles.label, { color: primary ? colors.onTint : colors.label }]}>{label}</Text>
    </Pressable>
  );
}

/** The compact action pills: Instagram (primary, only when available), WhatsApp, Más opciones and, when `onCopyLink` is given, Copiar link on its own line below. */
export function SharePills({
  instagram,
  whatsapp,
  disabled,
  onInstagram,
  onWhatsApp,
  onMore,
  onCopyLink,
}: {
  instagram: boolean;
  whatsapp: boolean;
  disabled: boolean;
  onInstagram: () => void;
  onWhatsApp: () => void;
  onMore: () => void;
  onCopyLink?: () => void;
}) {
  return (
    <View style={styles.column}>
      <View style={styles.row}>
        {instagram && <Pill label="Instagram" primary logo="instagram" disabled={disabled} onPress={onInstagram} />}
        {whatsapp && <Pill label="WhatsApp" logo="whatsapp" disabled={disabled} onPress={onWhatsApp} />}
        <Pill label="Más opciones" disabled={disabled} onPress={onMore} />
      </View>
      {onCopyLink && (
        <View style={styles.row}>
          {/* Copying needs no files: it is never disabled while the image builds. */}
          <Pill label="Copiar link" symbol="link" disabled={false} onPress={onCopyLink} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 8 },
  row: { flexDirection: "row", justifyContent: "center", gap: 6 },
  pill: { height: HEIGHT, paddingHorizontal: 14, borderRadius: HEIGHT / 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  primary: { backgroundColor: colors.tint },
  secondary: { backgroundColor: colors.fill },
  glyph: { width: GLYPH, height: GLYPH },
  label: { fontWeight: "600" },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.6 },
});
