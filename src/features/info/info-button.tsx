import { router } from "expo-router";
import { Pressable } from "react-native";
import { SymbolView } from "expo-symbols";
import { Button, Image } from "@expo/ui/swift-ui";
import { accessibilityLabel, buttonStyle } from "@expo/ui/swift-ui/modifiers";
import { colors } from "@/ui/theme";
import { INFO_TOPICS, type InfoTopicId } from "./topics";

const label = (topic: InfoTopicId) => `Más información sobre ${INFO_TOPICS[topic].title.toLowerCase()}`;
const open = (topic: InfoTopicId) => router.push({ pathname: "/info/[topic]", params: { topic } });

/** Small "i" next to a label in React Native screens; opens the info sheet for the topic. */
export function InfoButton({ topic }: { topic: InfoTopicId }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label(topic)}
      hitSlop={12}
      onPress={() => open(topic)}
    >
      <SymbolView name="info.circle" size={18} tintColor={colors.tint as string} />
    </Pressable>
  );
}

/** The same "i" as a native SwiftUI button, for rows inside a SwiftUI Form (Crear rollo). */
export function NativeInfoButton({ topic }: { topic: InfoTopicId }) {
  return (
    <Button onPress={() => open(topic)} modifiers={[buttonStyle("borderless"), accessibilityLabel(label(topic))]}>
      <Image systemName="info.circle" size={18} />
    </Button>
  );
}
