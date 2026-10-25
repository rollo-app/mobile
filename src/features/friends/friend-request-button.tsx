import { MenuView } from "@expo/ui/community/menu";
import { StyleSheet, View } from "react-native";
import { Button, ErrorText } from "@/ui/components";
import { spacing } from "@/ui/theme";
import type { FriendRequestUi } from "./friend-request";
import { useFriendRequest } from "./use-friend-request";

/**
 * Under someone's profile header when you aren't friends: "Agregar amigo"; "Solicitud enviada" (its menu cancels it);
 * or, if they asked you first, "Aceptar solicitud" and "Rechazar". The error shows under the button.
 */
export function FriendRequestButton({ userId, state }: { userId: string; state: FriendRequestUi }) {
  const request = useFriendRequest(userId);

  return (
    <View style={styles.box}>
      {state === "add" && <Button label="Agregar amigo" onPress={request.send} />}
      {state === "sent" && (
        <MenuView
          title="Solicitud enviada"
          actions={[{ id: "cancel", title: "Cancelar solicitud", image: "xmark", attributes: { destructive: true } }]}
          onPressAction={() => request.cancel()}
        >
          <Button label="Solicitud enviada" variant="secondary" onPress={() => undefined} />
        </MenuView>
      )}
      {state === "received" && (
        <>
          <Button label="Aceptar solicitud" onPress={request.accept} />
          <Button label="Rechazar" variant="secondary" onPress={request.reject} />
        </>
      )}
      {request.error && <ErrorText>{request.error}</ErrorText>}
    </View>
  );
}

const styles = StyleSheet.create({ box: { gap: spacing.sm } });
