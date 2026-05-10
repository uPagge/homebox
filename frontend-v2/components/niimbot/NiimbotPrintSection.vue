<script setup lang="ts">
import { Bluetooth, BluetoothConnected, Loader2, Printer } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { route } from "~~/lib/api/base/urls";
import { PRESET_TAPE_SIZES, type TapeSize } from "~~/composables/use-niimbot";

const props = defineProps<{
  type: "item" | "location";
  id: string;
}>();

const {
  isSupported,
  connected,
  deviceName,
  printing,
  printProgress,
  connect,
  disconnect,
  printImage,
  loadSavedTapeSize,
  saveTapeSize,
} = useNiimbot();

// Label variant
type LabelVariant = "full" | "qr";
const labelVariant = ref<LabelVariant>("full");

// Copies
const LS_COPIES_KEY = "niimbot_copies";
const copies = ref(1);

// Tape size
const selectedPresetIndex = ref(-1);
const customWidth = ref(50);
const customHeight = ref(30);
const isCustomSize = ref(false);

onMounted(() => {
  const saved = loadSavedTapeSize();
  const presetIdx = PRESET_TAPE_SIZES.findIndex(s => s.width === saved.width && s.height === saved.height);
  if (presetIdx >= 0) {
    selectedPresetIndex.value = presetIdx;
    isCustomSize.value = false;
  } else {
    isCustomSize.value = true;
    customWidth.value = saved.width;
    customHeight.value = saved.height;
  }
  const savedCopies = parseInt(localStorage.getItem(LS_COPIES_KEY) ?? "", 10);
  if (savedCopies >= 1 && savedCopies <= 99) copies.value = savedCopies;
});

function getCurrentTapeSize(): TapeSize {
  if (isCustomSize.value) {
    return {
      label: `${customWidth.value} × ${customHeight.value} mm`,
      width: customWidth.value,
      height: customHeight.value,
    };
  }
  return PRESET_TAPE_SIZES[selectedPresetIndex.value] ?? PRESET_TAPE_SIZES[2];
}

function getLabelImageUrl(): string {
  if (labelVariant.value === "qr") {
    const pageUrl = `${window.location.origin}/${props.type}/${props.id}`;
    return route("/qrcode", { data: pageUrl });
  }
  return route(`/labelmaker/${props.type}/${props.id}`);
}

async function handlePrint() {
  try {
    const tapeSize = getCurrentTapeSize();
    saveTapeSize(tapeSize);
    localStorage.setItem(LS_COPIES_KEY, String(copies.value));

    const url = getLabelImageUrl();
    await printImage(url, tapeSize, copies.value);
    toast.success("Печать завершена");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    toast.error(`Ошибка печати: ${msg}`);
  }
}

async function handleConnect() {
  try {
    if (connected.value) {
      await disconnect();
    } else {
      await connect();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    toast.error(`Ошибка подключения: ${msg}`);
  }
}

function onPresetChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  if (value === "custom") {
    isCustomSize.value = true;
    selectedPresetIndex.value = -1;
  } else {
    isCustomSize.value = false;
    selectedPresetIndex.value = Number(value);
  }
}
</script>

<template>
  <div v-if="isSupported" class="border border-border rounded-xl overflow-hidden bg-card">
    <div class="flex items-center justify-between px-4 py-3 border-b border-border">
      <span class="text-sm font-medium flex items-center gap-2">
        <Printer class="w-4 h-4" />
        Niimbot
      </span>
      <button
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition-colors"
        @click="handleConnect"
      >
        <BluetoothConnected v-if="connected" class="w-3.5 h-3.5 text-blue-500" />
        <Bluetooth v-else class="w-3.5 h-3.5" />
        {{ connected ? deviceName : 'Подключить' }}
      </button>
    </div>

    <div class="p-4 space-y-3">
      <!-- Label variant -->
      <div class="flex items-center gap-2">
        <label class="text-sm text-muted-foreground w-20 shrink-0">Этикетка</label>
        <select
          v-model="labelVariant"
          class="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="full">Полная</option>
          <option value="qr">Только QR</option>
        </select>
      </div>

      <!-- Tape size -->
      <div class="flex items-center gap-2">
        <label class="text-sm text-muted-foreground w-20 shrink-0">Размер</label>
        <select
          class="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          :value="isCustomSize ? 'custom' : selectedPresetIndex"
          @change="onPresetChange"
        >
          <option v-for="(size, idx) in PRESET_TAPE_SIZES" :key="idx" :value="idx">
            {{ size.label }}
          </option>
          <option value="custom">Свой размер</option>
        </select>
      </div>

      <!-- Custom size inputs -->
      <div v-if="isCustomSize" class="flex items-center gap-2 pl-[88px]">
        <input
          v-model.number="customWidth"
          type="number"
          min="10"
          max="100"
          class="w-16 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Ш"
        />
        <span class="text-sm text-muted-foreground">×</span>
        <input
          v-model.number="customHeight"
          type="number"
          min="10"
          max="200"
          class="w-16 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="В"
        />
        <span class="text-sm text-muted-foreground">мм</span>
      </div>

      <!-- Copies -->
      <div class="flex items-center gap-2">
        <label class="text-sm text-muted-foreground w-20 shrink-0">Копии</label>
        <input
          v-model.number="copies"
          type="number"
          min="1"
          max="99"
          class="w-20 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <!-- Print button -->
      <button
        class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        :disabled="printing"
        @click="handlePrint"
      >
        <Loader2 v-if="printing" class="w-4 h-4 animate-spin" />
        <Printer v-else class="w-4 h-4" />
        {{ printing ? `Печать... ${printProgress}%` : 'Печать' }}
      </button>
    </div>
  </div>
</template>
