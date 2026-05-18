<template>
  <nav class="bottom-menu" v-if="isAuthenticated">
    <!-- Левая кнопка: Новая инвентаризация (только для ревизора, только онлайн) -->
    <button
      v-if="isRevisor && !isFlightMode"
      class="bottom-menu-button left"
      @click="$emit('new-inventory')"
    >
      Новая инвентаризация
    </button>
    <div v-else class="bottom-menu-spacer"></div>

    <!-- Центральная кнопка: Инструменты (только для МОЛ) -->
    <button
      v-if="hasAccessToStatements"
      class="bottom-menu-button center"
      @click="$emit('tools')"
    >
      Инструменты
    </button>
    <div v-else class="bottom-menu-spacer"></div>

    <!-- Правая кнопка: Установить PWA (только онлайн) -->
    <button
      v-if="showInstall && !isFlightMode"
      class="bottom-menu-button right"
      @click="install"
    >
      Установить PWA
    </button>
    <div v-else class="bottom-menu-spacer"></div>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { usePwaInstall } from '@/composables/usePwaInstall'

const props = defineProps({
  isRevisor: {
    type: Boolean,
    default: false
  },
  hasAccessToStatements: {
    type: Boolean,
    default: false
  },
  isFlightMode: {
    type: Boolean,
    default: false
  }
})

defineEmits(['new-inventory', 'tools'])

const { showInstall, install } = usePwaInstall()

const isAuthenticated = computed(() => {
  return !!localStorage.getItem('auth_token')
})
</script>

<style scoped>
.bottom-menu {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background-color: #ffffff;
  border-top: 1px solid #000000;
  z-index: 100;
  height: 48px;
}

.bottom-menu-button {
  padding: 0.4rem 0.8rem;
  border: 1px solid #000000;
  background: #ffffff;
  color: #000000;
  font-family: monospace;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.bottom-menu-button:hover {
  background: #000000;
  color: #ffffff;
}

.bottom-menu-button.left {
  text-align: left;
}

.bottom-menu-button.center {
  text-align: center;
}

.bottom-menu-button.right {
  text-align: right;
}

.bottom-menu-spacer {
  /* Занимает место, когда кнопка скрыта */
}
</style>