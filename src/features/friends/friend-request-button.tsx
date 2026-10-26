import { StyleSheet, View } from "react-native";
import { Button, ErrorText } from "@/ui/components";
import { spacing } from "@/ui/theme";
import type { FriendRequestUi } from "./friend-request";
import { useFriendRequest } from "./use-friend-request";

/**
 * Under someone's profile header when you aren't friends: "Agregar amigo"; "Solicitud enviada" (tapping it again cancels it);
 * or, if they asked you first, "Aceptar solicitud" and "Rechazar". The error shows under the button.
 */
export function FriendRequestButton({ userId, state }: { userId: string; state: FriendRequestUi }) {
  const request = useFriendRequest(userId);

  return (
    <View style={styles.box}>
      {state === "add" && <Button label="Agregar amigo" onPress={request.send} />}
      {state === "sent" && <Button label="Solicitud enviada" variant="secondary" onPress={request.cancel} />}
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
