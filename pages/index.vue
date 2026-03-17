<template>
  <div class="w-full h-full"></div>
</template>

<script setup lang="ts">
import { useAppStore } from '~/stores/app'
import { useLibrariesStore } from '~/stores/libraries'
import { useUserStore } from '~/stores/user'

definePageMeta({ layout: 'blank' })

const appStore = useAppStore()
const librariesStore = useLibrariesStore()
const userStore = useUserStore()
const router = useRouter()

async function init() {
  await appStore.setupNetworkListener()
  const db = useDb()
  const deviceData = await db.getDeviceData() as Parameters<typeof appStore.setDeviceData>[0]
  appStore.setDeviceData(deviceData)
  await appStore.init()

  if (userStore.serverConnectionConfig) {
    router.push('/bookshelf')
  } else {
    router.push('/connect')
  }
}

onMounted(() => {
  librariesStore.reset()
  appStore.isFirstLoad = true
  init()
})
</script>
