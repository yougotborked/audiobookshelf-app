export default function ({ store, redirect, route }) {
  const user = store.state.user.user
  const serverConfig = store.state.user.serverConnectionConfig

  if (!user && !serverConfig) {
    if (route.name === 'playlist-id' && route.params.id === 'unfinished') return
    return redirect(`/connect?redirect=${route.path}`)
  }
}
