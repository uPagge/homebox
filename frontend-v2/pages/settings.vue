<script setup lang="ts">
import { Eye, EyeOff } from "lucide-vue-next";
import { useTheme, type ThemeMode } from "~/composables/use-theme";
import type { CurrenciesCurrency } from "~~/lib/api/types/data-contracts";
import { toast } from "vue-sonner";

const api = useUserApi();
const { mode, setTheme } = useTheme();

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "Системная" },
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
];

// --- Password ---
const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const showPasswords = ref(false);
const changingPassword = ref(false);

async function changePassword() {
  if (!currentPassword.value || !newPassword.value) return;
  if (newPassword.value !== confirmPassword.value) {
    toast.error("Пароли не совпадают");
    return;
  }
  if (newPassword.value.length < 8) {
    toast.error("Минимум 8 символов");
    return;
  }

  changingPassword.value = true;
  try {
    const resp = await api.user.changePassword(currentPassword.value, newPassword.value);
    if (resp.error) {
      toast.error("Не удалось сменить пароль");
      return;
    }
    toast.success("Пароль изменён");
    currentPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";
  } finally {
    changingPassword.value = false;
  }
}

// --- Currency ---
const currencies = ref<CurrenciesCurrency[]>([]);
const selectedCurrency = ref("");
const groupName = ref("");
const loadingCurrency = ref(false);

onMounted(async () => {
  const [currResp, groupResp] = await Promise.all([
    api.group.currencies(),
    api.group.get(),
  ]);
  if (currResp.data) currencies.value = currResp.data;
  if (groupResp.data) {
    selectedCurrency.value = groupResp.data.currency;
    groupName.value = groupResp.data.name;
  }
});

async function saveCurrency() {
  if (!selectedCurrency.value) return;
  loadingCurrency.value = true;
  try {
    const resp = await api.group.update({
      currency: selectedCurrency.value,
      name: groupName.value,
    });
    if (resp.error) {
      toast.error("Не удалось сохранить валюту");
      return;
    }
    toast.success("Валюта сохранена");
  } finally {
    loadingCurrency.value = false;
  }
}
</script>

<template>
  <div class="p-4 md:p-6 max-w-lg space-y-8">
    <h1 class="text-xl font-semibold">Настройки</h1>

    <!-- Theme -->
    <section class="space-y-2">
      <h2 class="text-sm font-medium">Тема</h2>
      <div class="flex gap-2">
        <button
          v-for="opt in themeOptions"
          :key="opt.value"
          class="px-4 py-2 rounded-lg text-sm border transition-colors"
          :class="mode === opt.value
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-card border-border hover:bg-accent'"
          @click="setTheme(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </section>

    <!-- Currency -->
    <section class="space-y-3">
      <h2 class="text-sm font-medium">Валюта</h2>
      <div class="flex gap-2">
        <select
          v-model="selectedCurrency"
          class="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option v-for="c in currencies" :key="c.code" :value="c.code">
            {{ c.symbol }} {{ c.name }} ({{ c.code }})
          </option>
        </select>
        <Button
          size="sm"
          :disabled="loadingCurrency"
          @click="saveCurrency"
        >
          {{ loadingCurrency ? '...' : 'Сохранить' }}
        </Button>
      </div>
    </section>

    <!-- Change Password -->
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium">Смена пароля</h2>
        <button
          class="p-1.5 rounded-md text-muted-foreground hover:bg-accent transition-colors"
          @click="showPasswords = !showPasswords"
        >
          <EyeOff v-if="showPasswords" class="w-4 h-4" />
          <Eye v-else class="w-4 h-4" />
        </button>
      </div>
      <div class="space-y-2">
        <input
          v-model="currentPassword"
          :type="showPasswords ? 'text' : 'password'"
          placeholder="Текущий пароль"
          class="w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          v-model="newPassword"
          :type="showPasswords ? 'text' : 'password'"
          placeholder="Новый пароль"
          class="w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          v-model="confirmPassword"
          :type="showPasswords ? 'text' : 'password'"
          placeholder="Повторите новый пароль"
          class="w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <Button
        class="w-full"
        :disabled="!currentPassword || !newPassword || !confirmPassword || changingPassword"
        @click="changePassword"
      >
        {{ changingPassword ? 'Сохраняем...' : 'Сменить пароль' }}
      </Button>
    </section>
  </div>
</template>
