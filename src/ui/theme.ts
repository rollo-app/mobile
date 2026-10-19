import { useColorScheme } from "react-native";

const light = {
  background: "#F6F2EA",
  surface: "#FFFFFF",
  text: "#1C1A17",
  muted: "#6B655C",
  border: "#E2DBCF",
  accent: "#D9480F",
  accentText: "#FFFFFF",
  danger: "#B42318",
};

const dark: typeof light = {
  background: "#151311",
  surface: "#1F1C19",
  text: "#F4EFE7",
  muted: "#A39B90",
  border: "#34302B",
  accent: "#FF7A3D",
  accentText: "#1C1A17",
  danger: "#FF8A80",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { md: 12, lg: 16 };
