<script setup lang="ts">
import { Plus, Pencil, Trash2, Wrench } from "lucide-vue-next";
import type { MaintenanceEntryWithDetails } from "~~/lib/api/types/data-contracts";
import { toast } from "vue-sonner";

const props = defineProps<{
  itemId: string;
}>();

const api = useUserApi();

const entries = ref<MaintenanceEntryWithDetails[]>([]);
const loading = ref(false);

async function fetchEntries() {
  loading.value = true;
  try {
    const resp = await api.items.maintenance.getLog(props.itemId);
    if (resp.data) {
      entries.value = resp.data;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(fetchEntries);

// Create / Edit sheet
const showSheet = ref(false);
const editEntry = ref<MaintenanceEntryWithDetails | null>(null);

function openCreate() {
  editEntry.value = null;
  showSheet.value = true;
}

function openEdit(entry: MaintenanceEntryWithDetails) {
  editEntry.value = entry;
  showSheet.value = true;
}

function handleSaved() {
  fetchEntries();
}

// Delete
const showDeleteDialog = ref(false);
const deleteTarget = ref<MaintenanceEntryWithDetails | null>(null);

function confirmDeleteEntry(entry: MaintenanceEntryWithDetails) {
  deleteTarget.value = entry;
  showDeleteDialog.value = true;
}

async function deleteEntry() {
  if (!deleteTarget.value) return;
  const resp = await api.maintenance.delete(deleteTarget.value.id);
  if (!resp.error) {
    toast.success("Запись удалена");
    fetchEntries();
  } else {
    toast.error("Не удалось удалить запись");
  }
  showDeleteDialog.value = false;
  deleteTarget.value = null;
}

function isCompleted(entry: MaintenanceEntryWithDetails): boolean {
  if (!entry.completedDate) return false;
  const d = new Date(entry.completedDate);
  return d.getFullYear() > 1;
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (d.getFullYear() <= 1) return "";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}
</script>

<template>
  <div class="border border-border rounded-xl overflow-hidden bg-card">
    <div class="flex items-center justify-between px-4 py-3 border-b border-border">
      <span class="text-sm font-medium">Обслуживание</span>
      <button
        class="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        @click="openCreate"
      >
        <Plus class="w-4 h-4" />
      </button>
    </div>

    <div class="p-4">
      <!-- Loading -->
      <div v-if="loading && entries.length === 0" class="space-y-2">
        <Skeleton v-for="i in 2" :key="i" class="h-10 w-full rounded" />
      </div>

      <!-- Empty -->
      <div
        v-else-if="entries.length === 0"
        class="text-center py-4 text-sm text-muted-foreground"
      >
        <Wrench class="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        Нет записей об обслуживании
      </div>

      <!-- Entries list -->
      <div v-else class="space-y-2">
        <div
          v-for="entry in entries"
          :key="entry.id"
          class="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors group"
        >
          <!-- Status dot -->
          <div
            class="w-2.5 h-2.5 rounded-full shrink-0"
            :class="isCompleted(entry) ? 'bg-green-500' : 'bg-amber-500'"
          />

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{{ entry.name }}</p>
            <p class="text-xs text-muted-foreground">
              <template v-if="isCompleted(entry)">
                Выполнено {{ formatDate(entry.completedDate) }}
              </template>
              <template v-else-if="formatDate(entry.scheduledDate)">
                Запланировано {{ formatDate(entry.scheduledDate) }}
              </template>
            </p>
          </div>

          <!-- Cost -->
          <span
            v-if="entry.cost && entry.cost !== '0'"
            class="text-xs text-muted-foreground tabular-nums shrink-0"
          >
            {{ parseFloat(entry.cost).toFixed(2) }}
          </span>

          <!-- Actions -->
          <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              class="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              @click="openEdit(entry)"
            >
              <Pencil class="w-3.5 h-3.5" />
            </button>
            <button
              class="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
              @click="confirmDeleteEntry(entry)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Sheet -->
    <MaintenanceEntrySheet
      v-model:open="showSheet"
      :item-id="itemId"
      :entry="editEntry"
      @saved="handleSaved"
    />

    <!-- Delete dialog -->
    <AlertDialog :open="showDeleteDialog" @update:open="showDeleteDialog = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить запись «{{ deleteTarget?.name }}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Запись об обслуживании будет удалена навсегда.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="deleteEntry"
          >
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
