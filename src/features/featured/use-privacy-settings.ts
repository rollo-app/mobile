import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/api/client";
import { fetchPrivacySettings, updatePrivacySettings, type PrivacySettings } from "./actions";

export const privacySettingsKey = ["privacy-settings"] as const;

/**
 * Ajustes → "Permitir que agreguen mis fotos a su perfil" (the account level of "where can your photos go").
 * On until the server says otherwise. The switch moves at once; if saving fails it goes back and `error` says why.
 */
export function usePrivacySettings() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: privacySettingsKey, queryFn: fetchPrivacySettings });

  const mutation = useMutation({
    mutationFn: (allowFeaturing: boolean) => updatePrivacySettings({ allowFeaturing }),
    onMutate: async (allowFeaturing) => {
      await queryClient.cancelQueries({ queryKey: privacySettingsKey });
      const before = queryClient.getQueryData<PrivacySettings>(privacySettingsKey);
      queryClient.setQueryData<PrivacySettings>(privacySettingsKey, { allowFeaturing });
      return { before };
    },
    onError: (_error, _value, context) => {
      if (context?.before) queryClient.setQueryData(privacySettingsKey, context.before);
    },
    onSuccess: (saved) => queryClient.setQueryData(privacySettingsKey, saved),
  });

  return {
    allowFeaturing: query.data?.allowFeaturing ?? true,
    saving: mutation.isPending,
    error: errorMessage(mutation.error, "No se pudo guardar"),
    set: (value: boolean) => mutation.mutate(value),
  };
}
