<script setup lang="ts">
import type { MaintenanceEntryWithDetails } from "~~/lib/api/types/data-contracts";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
  itemId: string;
  entry?: MaintenanceEntryWithDetails | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  saved: [];
}>();

const api = useUserApi();

const name = ref("");
const description = ref("");
const scheduledDate = ref("");
const completedDate = ref("");
const cost = ref("");
const saving = ref(false);

const isEdit = computed(() => !!props.entry);

watch(() => props.open, (isOpen) => {
  if (isOpen && props.entry) {
    name.value = props.entry.name;
    description.value = props.entry.description;
    scheduledDate.value = formatDateForInput(props.entry.scheduledDate);
    completedDate.value = formatDateForInput(props.entry.completedDate);
    cost.value = props.entry.cost || "0";
  } else if (isOpen) {
    name.value = "";
    description.value = "";
    scheduledDate.value = "";
    completedDate.value = "";
    cost.value = "0";
  }
});

function formatDateForInput(date: Date | string | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (d.getFullYear() <= 1) return "";
  return d.toISOString().split("T")[0];
}

async function save() {
  if (!name.value) return;

  saving.value = true;
  try {
    const data = {
      name: name.value,
      description: description.value,
      scheduledDate: scheduledDate.value ? new Date(scheduledDate.value) : new Date(0),
      completedDate: completedDate.value ? new Date(completedDate.value) : new Date(0),
      cost: cost.value || "0",
    };

    if (isEdit.value && props.entry) {
      const resp = await api.maintenance.update(props.entry.id, data);
      if (resp.error) {
        toast.error("Не удалось обновить запись");
        return;
      }
      toast.success("Запись обновлена");
    } else {
      const resp = await api.items.maintenance.create(props.itemId, data);
      if (resp.error) {
        toast.error("Не удалось создать запись");
        return;
      }
      toast.success("Запись добавлена");
    }

    emit("update:open", false);
    emit("saved");
  } finally {
    saving.value = false;
  }
}

function close() {
  emit("update:open", false);
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>{{ isEdit ? 'Редактировать запись' : 'Новая запись' }}</DrawerTitle>
      </DrawerHeader>

      <div class="px-4 pb-6 space-y-4">
        <div>
          <label class="text-sm font-medium" for="maint-name">Название</label>
          <input
            id="maint-name"
            v-model="name"
            type="text"
            required
            autofocus
            class="mt-1 w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Что нужно сделать"
          />
        </div>

        <div>
          <label class="text-sm font-medium" for="maint-desc">Описание</label>
          <Textarea
            id="maint-desc"
            v-model="description"
            class="mt-1"
            placeholder="Описание (необязательно)"
            rows="2"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm font-medium" for="maint-scheduled">Запланировано</label>
            <input
              id="maint-scheduled"
              v-model="scheduledDate"
              type="date"
              class="mt-1 w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label class="text-sm font-medium" for="maint-completed">Выполнено</label>
            <input
              id="maint-completed"
              v-model="completedDate"
              type="date"
              class="mt-1 w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div>
          <label class="text-sm font-medium" for="maint-cost">Стоимость</label>
          <input
            id="maint-cost"
            v-model="cost"
            type="text"
            inputmode="decimal"
            class="mt-1 w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="0"
          />
        </div>

        <div class="flex gap-2 pt-2">
          <Button
            class="flex-1"
            :disabled="!name || saving"
            @click="save"
          >
            {{ saving ? 'Сохраняем...' : (isEdit ? 'Сохранить' : 'Создать') }}
          </Button>
          <Button variant="outline" @click="close">
            Отмена
          </Button>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
