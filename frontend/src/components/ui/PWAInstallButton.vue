<template>
  <div v-if="showInstallButton" class="pwa-section">
    <p class="pwa-status">Для удобства рекомендуем</p>
    <BaseButton 
      variant="secondary"
      @click="installPWA"
      class="install-btn"
    >
      Установить PWA приложение
    </BaseButton>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import BaseButton from './BaseButton.vue'

const showInstallButton = ref(false)
const deferredPrompt = ref(null)
const isOnline = ref(navigator.onLine)

const updateOnlineStatus = () => {
  isOnline.value = navigator.onLine
  if (!isOnline.value) {
    showInstallButton.value = false
  }
}

const initPWA = () => {
  if (!isOnline.value) return
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt.value = e
    
    if (!window.matchMedia('(display-mode: standalone)').matches) {
      showInstallButton.value = true
    }
  })

  window.addEventListener('appinstalled', () => {
    showInstallButton.value = false
    deferredPrompt.value = null
  })
}

const installPWA = () => {
  if (deferredPrompt.value && isOnline.value) {
    deferredPrompt.value.prompt()
    deferredPrompt.value.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showInstallButton.value = false
      }
      deferredPrompt.value = null
    })
  }
}

onMounted(() => {
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
  initPWA()
})

onUnmounted(() => {
  window.removeEventListener('online', updateOnlineStatus)
  window.removeEventListener('offline', updateOnlineStatus)
})
</script>

<style scoped>
.pwa-section {
  text-align: center;
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing);
  border-top: 1px solid var(--border-color);
}

.pwa-status {
  font-size: 14px;
  color: #666;
  margin-bottom: var(--spacing-sm);
}

.install-btn {
  width: 100%;
  max-width: 300px;
}
</style>