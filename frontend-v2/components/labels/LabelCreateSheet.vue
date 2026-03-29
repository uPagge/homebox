<script setup lang="ts">
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [];
}>();

const api = useUserApi();

const name = ref("");
const description = ref("");
const color = ref("#ef4444");
const saving = ref(false);

async function save() {
  if (!name.value) return;

  saving.value = true;
  try {
    const resp = await api.tags.create({
      name: name.value,
      description: description.value,
      color: color.value,
    });
    if (resp.error) {
      toast.error("Не удалось создать метку");
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
  color.value = "#ef4444";
  emit("update:open", false);
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Новая метка</DrawerTitle>
      </DrawerHeader>

      <div class="px-4 pb-6 space-y-4">
        <div>
          <label class="text-sm font-medium" for="label-name">Название</label>
          <input
            id="label-name"
            v-model="name"
            type="text"
            required
            autofocus
            class="mt-1 w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Название метки"
          />
        </div>

        <div>
          <label class="text-sm font-medium" for="label-desc">Описание</label>
          <Textarea
            id="label-desc"
            v-model="description"
            class="mt-1"
            placeholder="Описание (необязательно)"
            rows="2"
          />
        </div>

        <div>
          <label class="text-sm font-medium">Цвет</label>
          <div class="mt-2">
            <ColorPalette v-model="color" />
          </div>
        </div>

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
