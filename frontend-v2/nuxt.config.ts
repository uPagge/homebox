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

  routeRules: {
    "/api/**": {
      proxy: { to: "http://localhost:7745/api/**" },
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
