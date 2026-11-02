import { useNavigation } from "expo-router";
import { useEffect, useState } from "react";

/** Puts the native search bar in the header of the current screen and returns what's typed in it. */
export function useSearchBar(): string {
  const navigation = useNavigation();
  const [text, setText] = useState("");

  useEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        placeholder: "Buscar por nombre o @usuario",
        autoCapitalize: "none",
        onChangeText: (e: { nativeEvent: { text: string } }) => setText(e.nativeEvent.text),
        onCancelButtonPress: () => setText(""),
      },
    });
  }, [navigation]);

  return text;
}
