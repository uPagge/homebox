<script setup lang="ts">
import { useTheme, type ThemeMode } from "~/composables/use-theme";

const { mode, setTheme } = useTheme();

const options: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
</script>

<template>
  <div class="p-4 md:p-6 max-w-lg">
    <h1 class="text-xl font-semibold mb-6">Settings</h1>

    <div class="space-y-4">
      <div>
        <label class="text-sm font-medium">Theme</label>
        <div class="flex gap-2 mt-2">
          <button
            v-for="opt in options"
            :key="opt.value"
            class="px-4 py-2 rounded-lg text-sm border transition-colors"
            :class="mode === opt.value
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card border-border hover:bg-accent'"
            @click="setTheme(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
