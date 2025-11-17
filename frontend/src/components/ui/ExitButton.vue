<template>
  <BaseButton 
    variant="danger" 
    size="small"
    @click="handleLogout"
  >
    Выйти
  </BaseButton>
</template>

<script setup>
import { useRouter } from 'vue-router'
import BaseButton from './BaseButton.vue'

const router = useRouter()

const handleLogout = () => {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('pending_token')
  router.push('/login')
}
</script>