export default function ({ store, redirect, route }) {
  const user = store.state.user.user
  const serverConfig = store.state.user.serverConnectionConfig

  if (!user && !serverConfig) {
    return redirect(`/connect?redirect=${route.path}`)
  }
}
