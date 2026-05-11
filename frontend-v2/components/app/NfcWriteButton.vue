<script setup lang="ts">
import { computed, ref } from "vue";
import { Nfc } from "lucide-vue-next";
import NfcWriteSheet from "./NfcWriteSheet.vue";
import type { HomeboxTarget } from "~/lib/scanner/parse-homebox-url";

const props = defineProps<{
  type: "item" | "location";
  id: string;
}>();

const isSupported = computed(() =>
  typeof window !== "undefined" && "NDEFReader" in window,
);

const open = ref(false);

const target = computed<HomeboxTarget>(() => ({
  kind: props.type,
  id: props.id,
}));
</script>

<template>
  <template v-if="isSupported">
    <button
      class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-accent transition-colors"
      @click="open = true"
    >
      <Nfc class="w-4 h-4" />
      Записать NFC-тег
    </button>
    <NfcWriteSheet v-model:open="open" :target="target" />
  </template>
</template>
