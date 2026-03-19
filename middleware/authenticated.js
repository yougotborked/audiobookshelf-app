export default defineNuxtRouteMiddleware((to) => {
  const userStore = useUserStore()

  if (!userStore.user && !userStore.serverConnectionConfig) {
    const redirectTarget = to.fullPath || '/'
    return navigateTo(`/connect?redirect=${encodeURIComponent(redirectTarget)}`)
  }
})
