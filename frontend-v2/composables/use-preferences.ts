import { useLocalStorage } from "@vueuse/core";

export interface ViewPreferences {
  theme: string;
  language?: string;
  collectionId?: string | null;
  itemDisplayView: "table" | "card";
}

const defaultPreferences: ViewPreferences = {
  theme: "system",
  itemDisplayView: "card",
};

export function useViewPreferences() {
  return useLocalStorage<ViewPreferences>("homebox-v2/preferences", defaultPreferences, {
    mergeDefaults: true,
  });
}
