<script setup lang="ts">
const showQuickAdd = ref(false);
</script>

<template>
  <div class="flex min-h-screen">
    <Sidebar>
      <template #search>
        <SearchBar />
      </template>
    </Sidebar>

    <main class="flex-1 min-w-0">
      <header class="md:hidden sticky top-0 z-40 bg-card border-b border-border px-4 py-2.5">
        <div class="flex items-center gap-3">
          <SearchBar class="flex-1" />
          <div class="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-sm">
            &#x1F464;
          </div>
        </div>
      </header>

      <div class="pb-20 md:pb-0">
        <slot />
      </div>
    </main>

    <BottomTabs @add="showQuickAdd = true" />
  </div>
</template>
