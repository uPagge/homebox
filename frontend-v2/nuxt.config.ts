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

  components: [
    { path: "~/components/app", pathPrefix: false },
    { path: "~/components/items", pathPrefix: false },
    { path: "~/components/items/detail", pathPrefix: false },
    { path: "~/components/locations", pathPrefix: false },
    { path: "~/components/labels", pathPrefix: false },
    { path: "~/components/maintenance", pathPrefix: false },
    { path: "~/components/niimbot", pathPrefix: false },
    "~/components/ui",
  ],

  devServer: {
    port: 3001,
  },

  nitro: {
    devProxy: {
      "/api": {
        target: "https://homebox.home.local/api",
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "",
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
