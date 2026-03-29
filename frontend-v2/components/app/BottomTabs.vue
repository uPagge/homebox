<script setup lang="ts">
import { Home, Package, MapPin, Menu, Plus } from "lucide-vue-next";

const route = useRoute();

const emit = defineEmits<{
  add: [];
}>();

const tabs = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/items", icon: Package, label: "Items" },
  { id: "add", icon: Plus, label: "Add" },
  { to: "/locations", icon: MapPin, label: "Places" },
  { to: "/more", icon: Menu, label: "More" },
] as const;

function isActive(to: string) {
  if (to === "/") return route.path === "/";
  return route.path.startsWith(to);
}
</script>

<template>
  <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border pb-[env(safe-area-inset-bottom)] z-50">
    <div class="flex justify-around items-center h-14">
      <template v-for="tab in tabs" :key="tab.label">
        <button
          v-if="'id' in tab && tab.id === 'add'"
          class="flex flex-col items-center"
          @click="emit('add')"
        >
          <div class="w-12 h-12 bg-primary rounded-full -mt-5 flex items-center justify-center shadow-lg">
            <Plus class="w-6 h-6 text-primary-foreground" />
          </div>
          <span class="text-[10px] text-muted-foreground mt-0.5">{{ tab.label }}</span>
        </button>

        <NuxtLink
          v-else-if="'to' in tab"
          :to="tab.to"
          class="flex flex-col items-center gap-0.5 min-w-[48px]"
          :class="isActive(tab.to) ? 'text-primary' : 'text-muted-foreground'"
        >
          <component :is="tab.icon" class="w-5 h-5" />
          <span class="text-[10px]" :class="isActive(tab.to) ? 'font-medium' : ''">
            {{ tab.label }}
          </span>
        </NuxtLink>
      </template>
    </div>
  </nav>
</template>
