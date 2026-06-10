<template>
  <div class="h-screen flex flex-col bg-gray-50">
    <!-- Хедер -->
    <header class="flex items-center gap-3 p-4 bg-white border-b border-gray-200 flex-shrink-0">
      <button
        class="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md
               active:bg-gray-100 transition"
        @click="handleBack"
      >
        ← Назад
      </button>
      <h1 class="text-lg font-semibold text-gray-800">Утилиты МОЛ</h1>
    </header>

    <!-- Список кнопок-утилит -->
    <main class="flex-1 overflow-y-auto p-4">
      <div class="flex flex-col gap-3">

        <!-- Кнопка "возможно произошло вовлечение" -->
        <button
          :class="[
            'w-full py-4 px-4 border rounded-lg text-base font-medium text-left transition',
            isInvolvementActive
              ? 'bg-gray-900 text-white border-gray-900 active:bg-black cursor-pointer'
              : 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'
          ]"
          :disabled="!isInvolvementActive"
          @click="handleInvolvement"
        >
          Возможно произошло вовлечение
        </button>

        <!-- Кнопка "возможно произошло перемещение" -->
        <button
          :class="[
            'w-full py-4 px-4 border rounded-lg text-base font-medium text-left transition',
            isMovementActive
              ? 'bg-gray-900 text-white border-gray-900 active:bg-black cursor-pointer'
              : 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'
          ]"
          :disabled="!isMovementActive"
          @click="handleMovement"
        >
          Возможно произошло перемещение
        </button>

      </div>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

/**
 * Возврат на главную страницу
 */
const handleBack = () => {
  router.push('/')
}

// ============================================================================
// УСЛОВИЯ АКТИВАЦИИ КНОПОК (заглушки)
// ============================================================================

/** Условие: возможно произошло вовлечение */
const isInvolvementActive = ref(true) // TODO: заменить на реальное условие (пока 1>0)

/** Условие: возможно произошло перемещение */
const isMovementActive = ref(true) // TODO: заменить на реальное условие (пока 1>0)

// ============================================================================
// ОБРАБОТЧИКИ КНОПОК
// ============================================================================

/**
 * Обработчик кнопки "возможно произошло вовлечение"
 */
const handleInvolvement = () => {
  // TODO: реализовать
}

/**
 * Обработчик кнопки "возможно произошло перемещение"
 */
const handleMovement = () => {
  // TODO: реализовать
}
</script>