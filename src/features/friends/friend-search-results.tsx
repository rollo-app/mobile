import { router } from "expo-router";
import { Avatar } from "@/features/profile/avatar";
import { formatHandle } from "@/features/profile/username";
import { Button, ErrorText, Footnote, Loading, Row, Section } from "@/ui/components";
import { SearchRequestButton } from "./search-request-button";
import { matchesSearch, normalizeSearch, SEARCH_MIN, searchQuery } from "./search-text";
import { useFriends } from "./use-friends";
import { useUserSearch } from "./use-user-search";

const MAX_RESULTS = 20;

/** What shows under the search bar: your matching friends right away, and (from 2 characters) other people from the server. */
export function FriendSearchResults({ text }: { text: string }) {
  const q = normalizeSearch(text);
  const { friends } = useFriends();
  const search = useUserSearch(text);
  const matching = (friends ?? []).filter((f) => matchesSearch(f, q));
  const searching = q.length >= SEARCH_MIN;
  // Results of an older query stay on screen while the next one loads; they only count as "the answer" when they are this query's.
  const current = search.query === searchQuery(text) && !search.isPlaceholderData;
  const results = search.results ?? [];

  return (
    <>
      {matching.length > 0 && (
        <Section title="Amigos">
          {matching.map((f) => (
            <Row
              key={f.id}
              leading={<Avatar id={f.id} name={f.name} avatarUrl={f.avatarUrl} size={40} />}
              label={f.name}
              detail={f.username ? formatHandle(f.username) : undefined}
              value="Amigos"
              accessibilityLabel={[f.name, f.username ? formatHandle(f.username) : null, "Amigos"].filter(Boolean).join(", ")}
              onPress={() => router.push(`/friends/user/${f.id}`)}
            />
          ))}
        </Section>
      )}

      {searching && results.length > 0 && (
        <Section title="Personas">
          {results.map((r) => (
            <Row
              key={r.id}
              leading={<Avatar id={r.id} name={r.name} avatarUrl={r.avatarUrl} size={40} />}
              label={r.name}
              detail={`${formatHandle(r.username)}${r.mutualCount > 0 ? ` · ${r.mutualCount} en común` : ""}`}
              accessibilityLabel={`${r.name}, ${formatHandle(r.username)}${r.mutualCount > 0 ? `, ${r.mutualCount} en común` : ""}`}
              accessory={<SearchRequestButton user={r} />}
              onPress={() => router.push(`/friends/user/${r.id}`)}
            />
          ))}
        </Section>
      )}

      {searching && search.error && (
        <>
          <ErrorText>{search.error}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void search.refetch()} loading={search.isRefetching && !search.isPlaceholderData} />
        </>
      )}
      {searching && !search.error && !search.results && <Loading />}
      {searching && !search.error && current && results.length === 0 && matching.length === 0 && <Footnote>{`No encontramos a nadie con "${text.trim()}".`}</Footnote>}
      {searching && !search.error && current && results.length >= MAX_RESULTS && <Footnote>Si no está, escribí más de su nombre o su @.</Footnote>}
    </>
  );
}
