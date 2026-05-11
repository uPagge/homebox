<script setup lang="ts">
import { Download, Settings, Tag, Wrench, Archive } from "lucide-vue-next";

const links = [
  { to: "/items/archived", icon: Archive, label: "Архив" },
  { to: "/labels", icon: Tag, label: "Теги" },
  { to: "/maintenance", icon: Wrench, label: "Обслуживание" },
  { to: "/settings", icon: Settings, label: "Настройки" },
];
</script>

<template>
  <div class="p-4">
    <h1 class="text-xl font-semibold mb-4">Ещё</h1>
    <div class="space-y-1">
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent transition-colors"
      >
        <component :is="link.icon" class="w-5 h-5 text-muted-foreground" />
        <span class="text-sm">{{ link.label }}</span>
        <span class="ml-auto text-muted-foreground">&#x203A;</span>
      </NuxtLink>
    </div>
  </div>
</template>
