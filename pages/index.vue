<template>
  <div class="w-full h-full"></div>
</template>

<script setup lang="ts">
import { useAppStore } from '~/stores/app'
import { useLibrariesStore } from '~/stores/libraries'

const appStore = useAppStore()
const librariesStore = useLibrariesStore()
const router = useRouter()

async function init() {
  await appStore.setupNetworkListener()
  const db = useDb()
  const deviceData = await db.getDeviceData() as Parameters<typeof appStore.setDeviceData>[0]
  appStore.setDeviceData(deviceData)
  await appStore.init()
  await appStore.setupNetworkListener()
  router.push('/bookshelf')
}

onMounted(() => {
  librariesStore.reset()
  appStore.isFirstLoad = true
  init()
})
</script>
