import { router, type Href } from "expo-router";
import { markPushPrimerSeen } from "@/storage/push-primer";
import { shouldOfferPushPrimer } from "./push-permission";
import { syncPushToken } from "./push-token";

/**
 * After creating or joining a roll, the moment notifications make sense:
 * - never asked → our own explanation (`/push-primer`), only once ever;
 * - already allowed → the token is registered silently;
 * - denied → nothing (it's in Ajustes → Notificaciones).
 * `next` is the sheet that comes after (e.g. "Sumar amigos"): the primer opens it when it closes.
 */
export async function offerPushAfterJoining(next?: Href): Promise<void> {
  let offer = false;
  try {
    offer = await shouldOfferPushPrimer();
    if (offer) await markPushPrimerSeen();
  } catch {
    offer = false;
  }
  if (offer) {
    router.push(next ? { pathname: "/push-primer", params: { next: String(next) } } : "/push-primer");
    return;
  }
  void syncPushToken();
  if (next) router.push(next);
}
