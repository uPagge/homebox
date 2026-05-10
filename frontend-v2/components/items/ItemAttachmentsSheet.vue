<script setup lang="ts">
import { Camera, Paperclip, Image, FileText, Receipt, Shield, Star } from "lucide-vue-next";
import type { ItemAttachment, ItemOut } from "~~/lib/api/types/data-contracts";
import { AttachmentTypes } from "~~/lib/api/types/non-generated";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
  itemId: string;
  attachments: ItemAttachment[];
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  updated: [item: ItemOut];
}>();

const api = useUserApi();
const { attachmentUrl: makeAttachmentUrl } = useAttachmentUrl();

const photoInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);

async function uploadFile(file: File, type: AttachmentTypes) {
  uploading.value = true;
  try {
    const resp = await api.items.attachments.add(props.itemId, file, file.name, type);
    if (resp.error || !resp.data) {
      toast.error("Не удалось загрузить файл");
      return;
    }
    emit("updated", resp.data);
    toast.success("Файл загружен");
  } catch {
    toast.error("Не удалось загрузить файл");
  } finally {
    uploading.value = false;
  }
}

async function onPhotoPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  await uploadFile(file, AttachmentTypes.Photo);
  if (photoInput.value) photoInput.value.value = "";
}

function iconForType(type: string) {
  switch (type) {
    case AttachmentTypes.Photo: return Image;
    case AttachmentTypes.Manual: return FileText;
    case AttachmentTypes.Receipt: return Receipt;
    case AttachmentTypes.Warranty: return Shield;
    default: return Paperclip;
  }
}

function labelForType(type: string): string {
  switch (type) {
    case AttachmentTypes.Photo: return "Фото";
    case AttachmentTypes.Manual: return "Инструкция";
    case AttachmentTypes.Receipt: return "Чек";
    case AttachmentTypes.Warranty: return "Гарантия";
    default: return "Файл";
  }
}
</script>

<template>
  <Drawer :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Файлы ({{ attachments.length }})</DrawerTitle>
      </DrawerHeader>

      <div class="px-4 pb-6 space-y-4 max-h-[70vh] overflow-y-auto">
        <div class="flex gap-2">
          <button
            :disabled="uploading"
            class="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg text-sm hover:bg-accent disabled:opacity-50 transition-colors"
            @click="photoInput?.click()"
          >
            <Camera class="w-4 h-4" />
            Фото
          </button>
          <button
            disabled
            class="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground"
          >
            <Paperclip class="w-4 h-4" />
            Файл
          </button>
        </div>

        <input
          ref="photoInput"
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden"
          @change="onPhotoPick"
        />

        <ul v-if="attachments.length" class="border border-border rounded-lg overflow-hidden divide-y divide-border">
          <li
            v-for="att in attachments"
            :key="att.id"
            class="flex items-center gap-3 p-3 bg-card"
          >
            <div class="w-10 h-10 shrink-0 rounded-md bg-muted/30 border border-border flex items-center justify-center overflow-hidden">
              <img
                v-if="att.type === 'photo' && att.thumbnail?.id"
                :src="makeAttachmentUrl(itemId, att.thumbnail.id)"
                :alt="att.title"
                class="w-full h-full object-cover"
              />
              <component :is="iconForType(att.type)" v-else class="w-5 h-5 text-muted-foreground" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-sm truncate">{{ att.title }}</span>
                <Star v-if="att.primary" class="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
              </div>
              <span class="text-xs text-muted-foreground">{{ labelForType(att.type) }}</span>
            </div>
          </li>
        </ul>
        <p v-else class="text-sm text-muted-foreground text-center py-6">
          Файлов нет
        </p>
      </div>
    </DrawerContent>
  </Drawer>
</template>
