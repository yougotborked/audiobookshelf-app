<template>
  <div class="w-full h-full overflow-y-auto">
    <div class="px-4 pt-4">
      <nuxt-link to="/playlist/unfinished" class="block mb-4">
        <covers-playlist-cover :items="autoPlaylist.items" :width="160" :height="160" />
        <p class="text-lg mt-2">{{ autoPlaylist.name }}</p>
      </nuxt-link>
    </div>
    <bookshelf-lazy-bookshelf page="playlists" />
  </div>
</template>

<script>
export default {
  async asyncData({ store, app }) {
    const progress = (store.state.user.user?.mediaProgress || []).filter((mp) => mp.episodeId && !mp.isFinished)
    const items = []
    for (const mp of progress) {
      const li = await app.$nativeHttp.get(`/api/items/${mp.libraryItemId}`).catch(() => null)
      if (!li) continue
      const ep = li.media?.episodes?.find((e) => e.id === mp.episodeId || e.serverEpisodeId === mp.episodeId)
      if (!ep) continue
      items.push({ libraryItem: li, episode: ep })
    }
    items.sort((a, b) => new Date(b.episode.pubDate || 0) - new Date(a.episode.pubDate || 0))
    const autoPlaylist = { id: 'unfinished', name: app.$strings.LabelAutoUnfinishedPodcasts, items }
    return { autoPlaylist }
  },
  data() {
    return {
      autoPlaylist: { name: '', items: [] }
    }
  }
}
</script>
