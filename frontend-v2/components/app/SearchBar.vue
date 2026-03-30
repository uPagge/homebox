<script setup lang="ts">
import { Search } from "lucide-vue-next";
import { useDialog, DialogID } from "@/components/ui/dialog-provider/utils";

const { openDialog } = useDialog();

function open() {
  openDialog(DialogID.QuickMenu);
}
</script>

<template>
  <button
    class="w-full flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors"
    @click="open"
  >
    <Search class="w-4 h-4" />
    <span>Поиск...</span>
    <kbd class="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded hidden md:inline">&#x2318;K</kbd>
  </button>
</template>
