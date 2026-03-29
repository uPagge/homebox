<script setup lang="ts">
import { Package, MapPin, Tag, Wallet } from "lucide-vue-next";

definePageMeta({ layout: "default" });

const { stats, locationBreakdown, tagBreakdown, loading, refresh } = useStats();
const router = useRouter();

onMounted(() => refresh());
</script>

<template>
  <div class="p-4 md:p-6 space-y-6">
    <div>
      <h1 class="text-xl font-semibold">Главная</h1>
      <p class="text-muted-foreground text-sm mt-0.5">Обзор инвентаря</p>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading && !stats" class="grid grid-cols-2 gap-3">
      <Skeleton v-for="i in 4" :key="i" class="h-20 rounded-xl" />
    </div>

    <!-- Stat cards -->
    <div v-else-if="stats" class="grid grid-cols-2 gap-3">
      <StatCard
        :icon="Package"
        label="Предметы"
        :value="stats.totalItems"
        to="/items"
      />
      <StatCard
        :icon="MapPin"
        label="Локации"
        :value="stats.totalLocations"
        to="/locations"
      />
      <StatCard
        :icon="Tag"
        label="Теги"
        :value="stats.totalTags"
        to="/labels"
      />
      <StatCard
        :icon="Wallet"
        label="Стоимость"
        :value="stats.totalItemPrice.toFixed(2)"
      />
    </div>

    <!-- Breakdown by locations -->
    <section v-if="locationBreakdown.length > 0">
      <h2 class="text-sm font-medium mb-3">По локациям</h2>
      <BreakdownList
        :items="locationBreakdown"
        :max-items="10"
        clickable
        @click="(id: string) => router.push(`/locations/${id}`)"
      />
    </section>

    <!-- Breakdown by tags -->
    <section v-if="tagBreakdown.length > 0">
      <h2 class="text-sm font-medium mb-3">По тегам</h2>
      <BreakdownList
        :items="tagBreakdown"
        :max-items="10"
      />
    </section>
  </div>
</template>
