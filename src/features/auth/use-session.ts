import { useEffect, useState } from "react";
import type { SessionStatus } from "./gate";
import { getSession, subscribeSession } from "./session";

/** The session token (`null` if there's none) and whether it's still being read from the keychain. */
export function useSession(): { status: SessionStatus; token: string | null } {
  const [state, setState] = useState<{ status: SessionStatus; token: string | null }>({ status: "loading", token: null });

  useEffect(() => {
    let active = true;
    const apply = (token: string | null) => active && setState({ status: token ? "in" : "out", token });
    void getSession().then(apply);
    const unsubscribe = subscribeSession(apply);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return state;
}
