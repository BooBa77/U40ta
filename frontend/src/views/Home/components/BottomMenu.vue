<template>
  <nav v-if="isAuthenticated" class="fixed bottom-0 left-0 right-0 flex justify-between items-center p-2 bg-white border-t border-gray-900 z-100 h-12">
    <!-- Левая кнопка: Новая инвентаризация (только для ревизора, только онлайн) -->
    <button
      v-if="isRevisor && !isFlightMode"
      class="px-2 py-1 border border-gray-900 bg-white text-gray-900 font-mono text-sm cursor-pointer transition-all hover:bg-gray-900 hover:text-white whitespace-nowrap text-left"
      @click="$emit('new-inventory')"
    >
      Новая инвентаризация
    </button>
    <div v-else class="w-32"></div>

    <!-- Центральная кнопка: Инструменты (только для МОЛ) -->
    <button
      v-if="hasAccessToStatements"
      class="px-2 py-1 border border-gray-900 bg-white text-gray-900 font-mono text-sm cursor-pointer transition-all hover:bg-gray-900 hover:text-white whitespace-nowrap text-center"
      @click="$emit('tools')"
    >
      МОЛ
    </button>
    <div v-else class="w-32"></div>

    <!-- Правая кнопка: Установить PWA (только онлайн) -->
    <button
      v-if="showInstall && !isFlightMode"
      class="px-2 py-1 border border-gray-900 bg-white text-gray-900 font-mono text-sm cursor-pointer transition-all hover:bg-gray-900 hover:text-white whitespace-nowrap text-right"
      @click="install"
    >
      PWA
    </button>
    <div v-else class="w-32"></div>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { usePwaInstall } from '@/composables/usePwaInstall'

/**
 * @typedef {Object} Props
 * @property {boolean} isRevisor - имеет ли пользователь роль ревизора
 * @property {boolean} hasAccessToStatements - имеет ли доступ к ведомостям (МОЛ)
 * @property {boolean} isFlightMode - включён ли режим полёта (офлайн)
 */

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

/**
 * События компонента
 * @event new-inventory - создание новой инвентаризационной книги (ревизор)
 * @event tools - открытие инструментов (МОЛ)
 */
defineEmits(['new-inventory', 'tools'])

const { showInstall, install } = usePwaInstall()

/**
 * Проверка авторизации пользователя
 * @returns {boolean} true если токен авторизации присутствует
 */
const isAuthenticated = computed(() => {
  return !!localStorage.getItem('auth_token')
})
</script>