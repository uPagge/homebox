<script setup lang="ts">
import { Toaster } from "~/components/ui/sonner";

useTheme();
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ClientOnly>
    <Toaster class="pointer-events-auto" />
  </ClientOnly>
</template>
