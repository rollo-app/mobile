import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ApiError } from "@/api/client";
import { Button, ErrorText } from "@/ui/components";
import { configKey } from "./actions";

/** The server refused to create a new account because registrations are closed (existing accounts are unaffected). */
export function isRegistrationsClosed(error: unknown): boolean {
  return error instanceof ApiError && error.code === "REGISTRATIONS_CLOSED";
}

/**
 * The server's message plus the way out: the waitlist form on the welcome screen. Nothing was created, so there is
 * nothing to sign out of; the config is refetched so the welcome screen shows the form.
 */
export function RegistrationsClosedNotice({ message }: { message: string }) {
  const queryClient = useQueryClient();
  return (
    <>
      <ErrorText>{message}</ErrorText>
      <Button
        label="Anotarme en la lista"
        variant="secondary"
        onPress={() => {
          // The server just said so: show the form right away, and let the refetch have the last word.
          queryClient.setQueryData(configKey, { registrationsOpen: false });
          void queryClient.invalidateQueries({ queryKey: configKey });
          router.dismissTo("/welcome");
        }}
      />
    </>
  );
}
