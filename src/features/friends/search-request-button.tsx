import { MenuView } from "@expo/ui/community/menu";
import { StyleSheet, View } from "react-native";
import { Button, ButtonPill, ErrorText } from "@/ui/components";
import { spacing } from "@/ui/theme";
import type { UserSearchResult } from "./actions";
import { useFriendRequest } from "./use-friend-request";

/** The request button at the end of a search row: "Agregar", "Enviada" (menu to cancel) or "Aceptar". The error shows under it. */
export function SearchRequestButton({ user }: { user: UserSearchResult }) {
  const request = useFriendRequest(user.id);

  return (
    <View style={styles.box}>
      {user.friendRequest === "none" && <Button size="small" label="Agregar" accessibilityLabel={`Agregar a ${user.name}`} onPress={request.send} />}
      {user.friendRequest === "sent" && (
        <MenuView title="Solicitud enviada" actions={[{ id: "cancel", title: "Cancelar solicitud", attributes: { destructive: true } }]} onPressAction={() => request.cancel()}>
          <ButtonPill label="Enviada" accessibilityLabel={`Solicitud enviada a ${user.name}, cancelar`} />
        </MenuView>
      )}
      {user.friendRequest === "received" && <Button size="small" label="Aceptar" accessibilityLabel={`Aceptar solicitud de ${user.name}`} onPress={request.accept} />}
      {request.error && <ErrorText>{request.error}</ErrorText>}
    </View>
  );
}

const styles = StyleSheet.create({ box: { alignItems: "flex-end", gap: spacing.xs } });
