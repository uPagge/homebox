<script setup lang="ts">
import { useAuthContext } from "~/composables/use-auth-context";
import { usePublicApi } from "~/composables/use-api";
import { toast } from "vue-sonner";

definePageMeta({ layout: "auth" });

const authCtx = useAuthContext();
const router = useRouter();

const email = ref("");
const password = ref("");
const stayLoggedIn = ref(true);
const loading = ref(false);
const errorMsg = ref("");

async function handleLogin() {
  if (!email.value || !password.value) return;

  loading.value = true;
  errorMsg.value = "";
  try {
    const api = usePublicApi();
    const result = await authCtx.login(api, email.value, password.value, stayLoggedIn.value);
    if (result.error) {
      errorMsg.value = "Login failed. Check your credentials.";
      return;
    }
    router.push("/");
  } catch (e: any) {
    errorMsg.value = `Connection error: ${e?.message || "Is the server running?"}`;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="w-full max-w-sm">
    <div class="text-center mb-8">
      <div class="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground text-xl font-bold mx-auto mb-4">
        H
      </div>
      <h1 class="text-2xl font-semibold">Homebox</h1>
      <p class="text-muted-foreground text-sm mt-1">Sign in to your inventory</p>
    </div>

    <div v-if="errorMsg" class="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
      {{ errorMsg }}
    </div>

    <form class="space-y-4" @submit.prevent="handleLogin">
      <div>
        <label class="text-sm font-medium" for="email">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          autocomplete="email"
          required
          class="mt-1 w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label class="text-sm font-medium" for="password">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          class="mt-1 w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="••••••••"
        />
      </div>

      <label class="flex items-center gap-2 text-sm">
        <input v-model="stayLoggedIn" type="checkbox" class="rounded" />
        Stay logged in
      </label>

      <button
        type="submit"
        :disabled="loading"
        class="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {{ loading ? "Signing in..." : "Sign in" }}
      </button>
    </form>
  </div>
</template>
