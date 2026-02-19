export default function ({ store, redirect, route }) {
  const user = store.state.user.user
  const serverConfig = store.state.user.serverConnectionConfig

  if (!user && !serverConfig) {
    const redirectTarget = route?.fullPath || route?.path || '/'
    return redirect(`/connect?redirect=${encodeURIComponent(redirectTarget)}`)
  }
}
