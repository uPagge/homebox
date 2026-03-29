<script setup lang="ts">
import {
  LayoutDashboard,
  Package,
  MapPin,
  Tag,
  Wrench,
  Printer,
  BarChart3,
  Download,
  Settings,
} from "lucide-vue-next";

const route = useRoute();

const mainNav = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/items", icon: Package, label: "Items" },
  { to: "/locations", icon: MapPin, label: "Locations" },
  { to: "/labels", icon: Tag, label: "Labels" },
  { to: "/maintenance", icon: Wrench, label: "Maintenance" },
  { to: "/print", icon: Printer, label: "Print Labels" },
];

const secondaryNav = [
  { to: "/reports", icon: BarChart3, label: "Reports" },
  { to: "/import", icon: Download, label: "Import/Export" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

function isActive(to: string) {
  if (to === "/") return route.path === "/";
  return route.path.startsWith(to);
}
</script>

<template>
  <aside class="hidden md:flex flex-col w-56 border-r border-border bg-card h-screen sticky top-0 shrink-0">
    <div class="flex items-center gap-2 px-4 h-14 border-b border-border">
      <div class="w-7 h-7 bg-primary rounded-md flex items-center justify-center text-primary-foreground text-sm font-bold">
        H
      </div>
      <span class="font-semibold text-sm">Homebox</span>
    </div>

    <div class="px-3 py-3">
      <slot name="search" />
    </div>

    <nav class="flex-1 px-2 space-y-0.5 overflow-y-auto">
      <NuxtLink
        v-for="item in mainNav"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors"
        :class="isActive(item.to)
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
      >
        <component :is="item.icon" class="w-4 h-4" />
        {{ item.label }}
      </NuxtLink>

      <div class="my-3 border-t border-border" />

      <NuxtLink
        v-for="item in secondaryNav"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors"
        :class="isActive(item.to)
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
      >
        <component :is="item.icon" class="w-4 h-4" />
        {{ item.label }}
      </NuxtLink>
    </nav>
  </aside>
</template>
