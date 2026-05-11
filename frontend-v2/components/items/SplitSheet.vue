<script setup lang="ts">
import { Scissors, MapPin } from "lucide-vue-next";
import type { ItemOut, ItemSummary } from "~~/lib/api/types/data-contracts";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
  item: ItemOut | ItemSummary;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  done: [payload: { newItemId: string; newName: string }];
}>();

const tree = useLocationTree();
const { split, processing } = useSplitItem();

const sourceQuantity = ref(0);
const extractQuantity = ref(1);
const newLocationId = ref("");
const newName = ref("");

const remaining = computed(() => sourceQuantity.value - extractQuantity.value);
const maxExtract = computed(() => Math.max(1, sourceQuantity.value - 1));

const sourceLocationPath = computed(() => {
  if (!props.item.location) return "—";
  return tree.getPathString(props.item.location.id) ?? props.item.location.name;
});

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    sourceQuantity.value = props.item.quantity;
    extractQuantity.value = Math.max(1, Math.floor(props.item.quantity / 2));
    newLocationId.value = "";
    newName.value = props.item.name;
  }
});

const canSubmit = computed(() =>
  !!newLocationId.value && !!newName.value.trim() && !processing.value
);

async function onSubmit() {
  if (!canSubmit.value) return;
  try {
    const { newItemId } = await split({
      sourceId: props.item.id,
      sourceQuantity: sourceQuantity.value,
      extractQuantity: extractQuantity.value,
      newLocationId: newLocationId.value,
      newName: newName.value.trim(),
    });
    const submittedName = newName.value.trim();
    emit("update:open", false);
    emit("done", { newItemId, newName: submittedName });
  } catch (e) {
    toast.error(`Не удалось разделить: ${e instanceof Error ? e.message : String(e)}`);
  }
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle class="flex items-center gap-2">
          <Scissors class="w-5 h-5" />
          Разделить (×{{ sourceQuantity }})
        </DrawerTitle>
      </DrawerHeader>

      <div class="px-4 pb-6 space-y-4">
        <!-- Source card -->
        <div class="bg-muted/30 border border-border rounded-lg p-3">
          <div class="text-xs text-muted-foreground mb-1">Исходный айтем</div>
          <div class="text-sm font-medium">{{ item.name }}</div>
          <div class="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <MapPin class="w-3 h-3 shrink-0" />
            <bdi class="truncate text-start" style="direction: rtl">{{ sourceLocationPath }}</bdi>
            <span class="shrink-0">· текущ. кол-во {{ sourceQuantity }}</span>
          </div>
        </div>

        <!-- Slider -->
        <div>
          <div class="flex items-center justify-center gap-4 mb-3">
            <div class="flex-1 text-center">
              <div class="text-xs text-muted-foreground mb-1">Останется</div>
              <div class="text-2xl font-semibold tabular-nums">{{ remaining }}</div>
            </div>
            <div class="text-muted-foreground/40">|</div>
            <div class="flex-1 text-center">
              <div class="text-xs text-primary mb-1">Выделить</div>
              <div class="text-2xl font-semibold tabular-nums text-primary">{{ extractQuantity }}</div>
            </div>
          </div>
          <input
            v-model.number="extractQuantity"
            type="range"
            min="1"
            :max="maxExtract"
            class="w-full accent-primary"
          />
          <div class="flex justify-between text-xs text-muted-foreground mt-1">
            <span>1</span>
            <span>{{ maxExtract }}</span>
          </div>
        </div>

        <!-- Location picker -->
        <div>
          <label class="text-xs font-medium text-muted-foreground mb-1.5 block">
            Куда переместить выделенное
          </label>
          <LocationPicker v-model="newLocationId" />
        </div>

        <!-- New name -->
        <div>
          <label class="text-xs font-medium text-muted-foreground mb-1.5 block">
            Название нового айтема
          </label>
          <input
            v-model="newName"
            type="text"
            class="w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div class="text-[11px] text-muted-foreground mt-1">
            Наследует: метки, описание, цену, кастомные поля, вложения
          </div>
        </div>

        <!-- Preview -->
        <div class="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-3">
          <div class="text-xs font-medium text-green-700 dark:text-green-400 mb-2">Результат:</div>
          <div class="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            <div class="bg-card rounded-md p-2 text-center border border-border">
              <div class="text-[11px] text-muted-foreground truncate">{{ item.name }}</div>
              <div class="text-base font-semibold">×{{ remaining }}</div>
            </div>
            <div class="text-muted-foreground text-sm">→</div>
            <div class="bg-card rounded-md p-2 text-center border border-primary/30">
              <div class="text-[11px] text-primary truncate">{{ newName || item.name }}</div>
              <div class="text-base font-semibold text-primary">×{{ extractQuantity }}</div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex gap-2 pt-2">
          <Button
            variant="outline"
            class="flex-1"
            :disabled="processing"
            @click="emit('update:open', false)"
          >
            Отмена
          </Button>
          <Button
            class="flex-1"
            :disabled="!canSubmit"
            @click="onSubmit"
          >
            {{ processing ? 'Разделяем...' : 'Разделить' }}
          </Button>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
