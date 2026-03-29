import { computed, watch } from "vue";
import { useViewPreferences } from "./use-preferences";
import { usePreferredDark } from "@vueuse/core";

export type ThemeMode = "light" | "dark" | "system";

export function useTheme() {
  const preferences = useViewPreferences();
  const prefersDark = usePreferredDark();

  const mode = computed<ThemeMode>({
    get: () => (preferences.value.theme as ThemeMode) || "system",
    set: (v) => {
      preferences.value.theme = v;
    },
  });

  const isDark = computed(() => {
    if (mode.value === "system") return prefersDark.value;
    return mode.value === "dark";
  });

  watch(
    isDark,
    (dark) => {
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", dark);
      }
    },
    { immediate: true }
  );

  return { mode, isDark, setTheme: (m: ThemeMode) => (mode.value = m) };
}
