export default defineNuxtConfig({
  ssr: false,

  modules: [
    "@nuxtjs/tailwindcss",
    "@pinia/nuxt",
    "@vueuse/nuxt",
    "shadcn-nuxt",
    "unplugin-icons/nuxt",
  ],

  shadcn: {
    prefix: "",
    componentDir: "./components/ui",
  },

  devServer: {
    port: 3001,
  },

  nitro: {
    devProxy: {
      "/api": {
        target: "https://homebox.home.local/api",
        changeOrigin: true,
        secure: false,
      },
    },
  },

  css: ["~/assets/css/main.css"],

  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },

  compatibilityDate: "2025-01-01",
});
