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
        <!-- Кнопка 1 (заглушка) -->
        <button
          class="w-full py-4 px-4 bg-gray-200 text-gray-400 border border-gray-300 rounded-lg
                 text-base font-medium cursor-not-allowed text-left"
          disabled
        >
          Кнопка 1
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

/**
 * Возврат на главную страницу
 */
const handleBack = () => {
  router.push('/')
}
</script>