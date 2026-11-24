import { MenuView, type MenuComponentProps } from "@expo/ui/community/menu";
import { useCallback, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";

/**
 * `MenuView` for a full-width row (long-press or tap menu on a list row). On iOS the menu wraps its trigger in a native
 * host that sizes to its content, so a row inside it ends right after its text: the pressed highlight is cut and trailing
 * content (badges, chevrons) sits next to the label. This measures the width outside the host and gives it to the content.
 */
export function FullWidthMenuView({ children, ...menu }: MenuComponentProps) {
  const [width, setWidth] = useState<number | null>(null);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
  }, []);
  return (
    <View testID="full-width-menu" onLayout={onLayout}>
      <MenuView {...menu}>
        <View testID="full-width-menu-content" style={width !== null ? { width } : undefined}>
          {children}
        </View>
      </MenuView>
    </View>
  );
}
