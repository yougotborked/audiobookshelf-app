<template>
  <bookshelf-lazy-bookshelf page="books" />
</template>

<script setup lang="ts">
const route = useRoute()
const userStore = useUserStore()

if (route.query.filter) {
  await userStore.updateUserSettings({ mobileFilterBy: route.query.filter as string })
}
</script>
