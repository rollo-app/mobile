import { router } from "expo-router";
import { Avatar } from "@/features/profile/avatar";
import { formatHandle } from "@/features/profile/username";
import { Button, ErrorText, Footnote, Loading, Row, Screen, Section } from "@/ui/components";
import { useBlocked } from "./use-blocked";

/** The people you blocked. Tapping one opens their profile, where you can unblock them. */
export function BlockedScreen() {
  const { blocked, error, refetch, isRefetching } = useBlocked();

  return (
    <Screen grouped>
      {error && (
        <>
          <ErrorText>{error}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
        </>
      )}
      {!error && !blocked && <Loading />}
      {blocked && blocked.length === 0 && <Footnote>No bloqueaste a nadie.</Footnote>}
      {blocked && blocked.length > 0 && (
        <Section>
          {blocked.map((b) => (
            <Row
              key={b.id}
              leading={<Avatar id={b.id} name={b.name} avatarUrl={b.avatarUrl} size={40} />}
              label={b.name}
              detail={b.username ? formatHandle(b.username) : undefined}
              onPress={() => router.push(`/user/${b.id}`)}
            />
          ))}
        </Section>
      )}
    </Screen>
  );
}
