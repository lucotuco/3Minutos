import colors from "@/constants/colors";
import { useColorScheme } from "./use-color-scheme";

type Palette = typeof colors.light;

export function useColors(): Palette {
  const scheme = useColorScheme();
  // The project only defines a light palette for now; fall back to it for dark as well.
  const palette: Palette =
    scheme === "dark" && (colors as any).dark ? (colors as any).dark : colors.light;

  return {
    ...palette,
  };
}
