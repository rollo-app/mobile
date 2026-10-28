import { useState } from "react";
import { Share } from "react-native";
import { errorMessage } from "@/api/client";
import { ErrorText, Row, Section } from "@/ui/components";
import type { FriendLink } from "./actions";
import { friendLinkUrl } from "./friend-link";
import { useCreateFriendLink } from "./use-create-friend-link";

/** Makes the friend link (1 hour, replaces the previous one) and offers to share it. */
export function InviteFriend() {
  const [link, setLink] = useState<FriendLink | null>(null);
  const create = useCreateFriendLink();
  const loading = create.isPending;
  const error = errorMessage(create.error, "No se pudo armar el link");

  function generate() {
    create.mutate(undefined, { onSuccess: setLink });
  }

  const share = () => {
    if (!link) return;
    void Share.share({
      message: `Sumate como amigo en Rollo: ${friendLinkUrl(link.code)}\nSi no se abre, escribí el código ${link.code} cuando armes tu perfil.`,
    });
  };

  return (
    <>
      {link ? (
        <Section title="Tu link" footer="Vale 1 hora y lo puede abrir cualquiera que lo reciba. Si armás otro, este deja de servir.">
          <Row label="Código" value={link.code} />
          <Row label="Compartir" chevron={false} onPress={share} />
          <Row label="Armar otro link" chevron={false} loading={loading} onPress={loading ? undefined : generate} />
        </Section>
      ) : (
        <Section footer="Mandales un link: cuando lo abren, quedan como amigos tuyos.">
          <Row label="Invitar a un amigo" chevron={false} loading={loading} onPress={loading ? undefined : generate} />
        </Section>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </>
  );
}
