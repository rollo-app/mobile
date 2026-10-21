import { useState } from "react";
import { Share } from "react-native";
import { ErrorText, Row, Section } from "@/ui/components";
import { createFriendLink, type FriendLink } from "./actions";
import { friendLinkUrl } from "./friend-link";

/** Makes the friend link (1 hour, replaces the previous one) and offers to share it. */
export function InviteFriend() {
  const [link, setLink] = useState<FriendLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setLoading(true);
    try {
      setLink(await createFriendLink());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo armar el link");
    } finally {
      setLoading(false);
    }
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
          <Row label="Compartir" onPress={share} />
          <Row label="Armar otro link" loading={loading} onPress={loading ? undefined : () => void generate()} />
        </Section>
      ) : (
        <Section footer="Mandales un link: cuando lo abren, quedan como amigos tuyos.">
          <Row label="Invitar a un amigo" loading={loading} onPress={loading ? undefined : () => void generate()} />
        </Section>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </>
  );
}
