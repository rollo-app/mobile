import { useMutation } from "@tanstack/react-query";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { signInWithApple } from "./actions";
import { appleSignInEnabled } from "./apple";

/** Signs in with Apple. Like the code, the session flips the gate on its own; a canceled sheet resolves to null. */
export function useAppleSignIn() {
  return useMutation({ mutationFn: signInWithApple });
}

/** Whether to show "Continuar con Apple": a build with the entitlement, on a device where Apple says it works. */
export function useAppleSignInAvailable(): boolean {
  const enabled = appleSignInEnabled(Constants.expoConfig);
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => alive && setAvailable(ok))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled]);
  return enabled && available;
}
