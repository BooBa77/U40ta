<template>
  <nav v-if="isAuthenticated" class="fixed bottom-0 left-0 right-0 grid grid-cols-3 items-center p-2 bg-white border-t border-gray-200 z-100 h-14">
    <!-- Левая: Новая ревизия -->
    <button
      v-if="isRevisor && !isFlightMode"
      class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap justify-self-start
             bg-[#B81C1C] text-white hover:bg-[#8B1515] active:bg-[#6B1010]"
      @click="$emit('new-inventory')"
    >
      Новая ревизия
    </button>

    <!-- Центр: МОЛ -->
    <button
      v-if="hasAccessToStatements"
      class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap justify-self-center
             bg-gray-900 text-white hover:bg-gray-700 active:bg-gray-600"
      @click="handleMOL"
    >
      МОЛ
    </button>

    <!-- Правая: PWA -->
    <button
      v-if="showInstall && !isFlightMode"
      class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap justify-self-end
             bg-[#a7defa] text-gray-800 hover:bg-[#8bcfe8] active:bg-[#70bfdb]"
      @click="install"
    >
      PWA
    </button>
  </nav>  
</template>

<script>
export default {
  name: 'BottomMenu',
  
  props: {
    isAuthenticated: {
      type: Boolean,
      default: false
    },
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
    },
    showInstall: {
      type: Boolean,
      default: false
    }
  },

  emits: ['new-inventory', 'mol'],

  methods: {
    handleMOL() {
      this.$emit('mol')
    },
    install() {
      this.$emit('install')
    }
  }
}
</script>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
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
 */
defineEmits(['new-inventory'])

const router = useRouter()
const { showInstall, install } = usePwaInstall()

/**
 * Проверка авторизации пользователя
 * @returns {boolean} true если токен авторизации присутствует
 */
const isAuthenticated = computed(() => {
  return !!localStorage.getItem('auth_token')
})

/**
 * Переход на страницу утилит МОЛ
 */
const handleMOL = () => {
  router.push('/mol')
}
</script>