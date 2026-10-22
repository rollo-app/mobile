import { MenuView, type MenuAction } from "@expo/ui/community/menu";
import { SymbolView } from "expo-symbols";
import { Color } from "expo-router";
import { useBlock } from "./use-block";
import { useReport } from "./use-report";

/** The "…" in someone's profile header: Denunciar (once) and Bloquear / Desbloquear. */
export function ProfileMenu({
  userId,
  name,
  reported,
  blocked,
}: {
  userId: string;
  name: string;
  reported: boolean;
  blocked: boolean;
}) {
  const report = useReport();
  const block = useBlock(userId, name);

  const actions: MenuAction[] = [
    ...(reported ? [] : [{ id: "report", title: "Denunciar", image: "exclamationmark.bubble" as const, attributes: { disabled: report.busy } }]),
    blocked
      ? { id: "unblock", title: "Desbloquear", image: "hand.raised.slash" as const, attributes: { disabled: block.busy } }
      : { id: "block", title: "Bloquear", image: "hand.raised" as const, attributes: { destructive: true, disabled: block.busy } },
  ];

  return (
    <MenuView
      actions={actions}
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent.event === "report") void report.reportUser(userId, name);
        else if (nativeEvent.event === "block") block.confirmBlock();
        else void block.unblock();
      }}
    >
      <SymbolView accessibilityLabel="Más opciones" name="ellipsis" size={20} tintColor={Color.ios.label} />
    </MenuView>
  );
}
