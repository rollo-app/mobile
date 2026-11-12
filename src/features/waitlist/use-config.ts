import { useQuery } from "@tanstack/react-query";
import { configKey, fetchConfig } from "./actions";

/**
 * The server's public config. Registrations count as open until the server says they aren't: a failed or
 * offline request must never keep existing users out. Short stale time so a reopening shows up quickly.
 */
export function useRegistrationsOpen(): boolean {
  const { data } = useQuery({ queryKey: configKey, queryFn: fetchConfig, staleTime: 10_000 });
  return data?.registrationsOpen !== false;
}
