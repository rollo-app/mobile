import { StyleSheet, View } from "react-native";
import { Button, ErrorText } from "@/ui/components";
import { spacing } from "@/ui/theme";
import type { UserSearchResult } from "./actions";
import { useFriendRequest } from "./use-friend-request";

/** The request button at the end of a search row: "Agregar", "Enviada" (tapping it again cancels) or "Aceptar". The error shows under it. */
export function SearchRequestButton({ user }: { user: UserSearchResult }) {
  const request = useFriendRequest(user.id);

  return (
    <View style={styles.box}>
      {user.friendRequest === "none" && <Button size="small" label="Agregar" accessibilityLabel={`Agregar a ${user.name}`} onPress={request.send} />}
      {user.friendRequest === "sent" && (
        <Button size="small" variant="secondary" label="Enviada" accessibilityLabel={`Solicitud enviada a ${user.name}, cancelar`} onPress={request.cancel} />
      )}
      {user.friendRequest === "received" && <Button size="small" label="Aceptar" accessibilityLabel={`Aceptar solicitud de ${user.name}`} onPress={request.accept} />}
      {request.error && <ErrorText>{request.error}</ErrorText>}
    </View>
  );
}

const styles = StyleSheet.create({ box: { alignItems: "flex-end", gap: spacing.xs } });
