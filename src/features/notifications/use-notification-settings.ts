import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { fetchNotificationSettings, updateNotificationSettings, type NotificationSettings } from "./actions";

export const notificationSettingsKey = ["notification-settings"] as const;

export type NotificationKind = keyof NotificationSettings;

/**
 * Ajustes → Notificaciones: which pushes you get. A switch moves at once and saves only its own key;
 * if saving fails it goes back and `saveError` says which one and why.
 */
export function useNotificationSettings() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: notificationSettingsKey, queryFn: fetchNotificationSettings });
  const [saveError, setSaveError] = useState<{ kind: NotificationKind; message: string } | null>(null);
  // While several switches are saving, the server's answer to one would undo the others' optimistic value.
  const saving = useRef(0);

  const put = (kind: NotificationKind, value: boolean) =>
    queryClient.setQueryData<NotificationSettings>(notificationSettingsKey, (old) => old && { ...old, [kind]: value });

  async function set(kind: NotificationKind, value: boolean) {
    setSaveError(null);
    saving.current += 1;
    put(kind, value);
    try {
      const saved = await updateNotificationSettings({ [kind]: value });
      if (saving.current === 1) queryClient.setQueryData(notificationSettingsKey, saved);
    } catch (e) {
      put(kind, !value);
      setSaveError({ kind, message: e instanceof Error ? e.message : "No se pudo guardar" });
    } finally {
      saving.current -= 1;
    }
  }

  return {
    settings: query.data,
    loadError: query.error ? query.error.message : null,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    saveError,
    set,
  };
}
