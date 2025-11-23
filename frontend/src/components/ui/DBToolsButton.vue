<template>
  <button class="big-home-button" @click="navigateToDBTools" title="Работа с данными">
    <img src="/images/list.png" alt="Работа с данными" class="button-icon">
  </button>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const navigateToDBTools = () => {
  router.push('/dbtools')
}
</script>

<style scoped>
/* Стили в global.css */
</style>