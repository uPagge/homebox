<script setup lang="ts">
import type { LocationOutCount } from "~~/lib/api/types/data-contracts";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
  parentId?: string | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [];
}>();

const api = useUserApi();

const name = ref("");
const description = ref("");
const selectedParentId = ref<string>(props.parentId ?? "");
const saving = ref(false);

// Load all locations for parent picker
const allLocations = ref<LocationOutCount[]>([]);
async function loadLocations() {
  const resp = await api.locations.getAll({ filterChildren: false });
  if (resp.data) allLocations.value = resp.data;
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    loadLocations();
    selectedParentId.value = props.parentId ?? "";
  }
});

async function save() {
  if (!name.value) return;

  saving.value = true;
  try {
    const body: { name: string; description: string; parentId?: string } = {
      name: name.value,
      description: description.value,
    };
    if (selectedParentId.value) {
      body.parentId = selectedParentId.value;
    }

    const resp = await api.locations.create(body);
    if (resp.error) {
      toast.error("Не удалось создать локацию");
      return;
    }

    toast.success(`«${name.value}» создана`);
    resetAndClose();
    emit("created");
  } finally {
    saving.value = false;
  }
}

function resetAndClose() {
  name.value = "";
  description.value = "";
  selectedParentId.value = "";
  emit("update:open", false);
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Новая локация</DrawerTitle>
      </DrawerHeader>

      <div class="px-4 pb-6 space-y-4">
        <!-- Name -->
        <div>
          <label class="text-sm font-medium" for="loc-name">Название</label>
          <input
            id="loc-name"
            v-model="name"
            type="text"
            required
            autofocus
            class="mt-1 w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Название локации"
          />
        </div>

        <!-- Description -->
        <div>
          <label class="text-sm font-medium" for="loc-desc">Описание</label>
          <Textarea
            id="loc-desc"
            v-model="description"
            class="mt-1"
            placeholder="Описание (необязательно)"
            rows="2"
          />
        </div>

        <!-- Parent location -->
        <div>
          <label class="text-sm font-medium" for="loc-parent">Родительская локация</label>
          <select
            id="loc-parent"
            v-model="selectedParentId"
            class="mt-1 w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Без родителя (корневая)</option>
            <option v-for="loc in allLocations" :key="loc.id" :value="loc.id">
              {{ loc.name }}
            </option>
          </select>
        </div>

        <!-- Actions -->
        <div class="flex gap-2 pt-2">
          <Button
            class="flex-1"
            :disabled="!name || saving"
            @click="save"
          >
            {{ saving ? 'Создаём...' : 'Создать' }}
          </Button>
          <Button
            variant="outline"
            @click="resetAndClose"
          >
            Отмена
          </Button>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
