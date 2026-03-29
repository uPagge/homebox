import { useAuthContext } from "~/composables/use-auth-context";

export default defineNuxtRouteMiddleware((to) => {
  const publicRoutes = ["/login"];
  if (publicRoutes.includes(to.path)) return;

  const authCtx = useAuthContext();
  if (!authCtx.isAuthorized()) {
    return navigateTo("/login");
  }
});
