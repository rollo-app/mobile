import { magicLinkPath } from "@/features/auth/magic-link";
import { friendLinkPath } from "@/features/friends/friend-link";

/**
 * Universal Links (`https://rollo.juanifraga.com/entrar#…` and `/friends#CODE`) arrive here as the full
 * URL; they are mapped to the routes that already handle the `rollo://` forms. Anything else is left as is
 * (returning null would drop the navigation). It must never throw: that would crash the app.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return magicLinkPath(path) ?? friendLinkPath(path) ?? path;
  } catch {
    return path;
  }
}
