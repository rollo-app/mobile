import { screen } from "expo-router/testing-library";

type Node = { type: string; props: Record<string, unknown>; children: (Node | string)[] | null };

/** The bottom bar's triggers, in order, as [route name, SF symbol]. Reads react-native-screens' native tab nodes. */
export function tabBar(): [unknown, unknown][] {
  const found: [unknown, unknown][] = [];
  const walk = (n: Node | Node[] | string | null) => {
    if (!n || typeof n === "string") return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.type === "RNSTabsScreenIOS" && !n.props.hidden) found.push([n.props.screenKey, n.props.iconResourceName]);
    n.children?.forEach(walk);
  };
  walk(screen.toJSON() as never);
  return found;
}
