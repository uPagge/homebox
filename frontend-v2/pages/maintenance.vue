<script setup lang="ts">
import { Wrench } from "lucide-vue-next";
import { MaintenanceFilterStatus } from "~~/lib/api/types/data-contracts";

definePageMeta({ layout: "default" });

const { entries, loading, status, refresh, setStatus } = useMaintenance();

const tabs = [
  { label: "Все", value: MaintenanceFilterStatus.MaintenanceFilterStatusBoth },
  { label: "Запланировано", value: MaintenanceFilterStatus.MaintenanceFilterStatusScheduled },
  { label: "Выполнено", value: MaintenanceFilterStatus.MaintenanceFilterStatusCompleted },
];

onMounted(() => refresh());
</script>

<template>
  <div class="p-4 md:p-6 space-y-4">
    <!-- Header -->
    <h1 class="text-xl font-semibold">Обслуживание</h1>

    <!-- Filter tabs -->
    <div class="flex gap-1 bg-muted p-1 rounded-lg w-fit">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="px-3 py-1.5 text-sm rounded-md transition-colors"
        :class="status === tab.value
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'"
        @click="setStatus(tab.value)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading && entries.length === 0" class="space-y-2">
      <Skeleton v-for="i in 6" :key="i" class="h-14 w-full rounded-lg" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!loading && entries.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <Wrench class="w-12 h-12 text-muted-foreground/50 mb-3" />
      <h3 class="text-sm font-medium">Нет записей</h3>
      <p class="text-xs text-muted-foreground mt-1">
        Записи об обслуживании создаются на странице предмета
      </p>
    </div>

    <!-- Entries list -->
    <div v-else class="bg-card border border-border rounded-xl overflow-hidden">
      <MaintenanceEntryRow
        v-for="entry in entries"
        :key="entry.id"
        :entry="entry"
      />
    </div>
  </div>
</template>
