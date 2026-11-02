import { useNavigation } from "expo-router";
import { useEffect, useState } from "react";

/**
 * Puts the native search in the header of the current screen and returns what's typed in it. On iOS 26 it is a
 * magnifier button at the top right that expands into the field (always visible, no need to pull the list down);
 * kept out of the tab bar so it stays in the header. Earlier iOS shows the field inline at the trailing edge.
 */
export function useSearchBar(): string {
  const navigation = useNavigation();
  const [text, setText] = useState("");

  useEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        placement: "integratedButton",
        allowToolbarIntegration: false,
        placeholder: "Buscar por nombre o @usuario",
        autoCapitalize: "none",
        onChangeText: (e: { nativeEvent: { text: string } }) => setText(e.nativeEvent.text),
        onCancelButtonPress: () => setText(""),
      },
    });
  }, [navigation]);

  return text;
}
