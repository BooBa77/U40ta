<template>
  <Transition name="modal">
    <div v-if="isOpen" class="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50" @click.self="handleBack">
      <div class="bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden" style="width: 500px; max-width: 90vw; max-height: 85vh;">
        
        <!-- Хедер -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 class="text-lg font-semibold text-gray-900">
            Объект вне ведомости
          </h3>
          <button 
            class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400
                   active:bg-gray-100 active:text-gray-900"
            @click="handleBack"
            aria-label="Назад"
          >
            ×
          </button>
        </div>

        <!-- Контент -->
        <div class="overflow-y-auto flex-1 p-5">
          <p class="text-gray-600 text-sm mb-4">
            Объект ID: {{ objectId }}
          </p>
          <p class="text-gray-400 text-sm">
            Функционал в разработке
          </p>
        </div>

        <!-- Футер -->
        <div class="flex justify-start px-5 py-4 border-t border-gray-100 shrink-0">
          <button 
            @click="handleBack"
            class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium
                   hover:bg-gray-300 transition"
          >
            ← Назад
          </button>
        </div>

      </div>
    </div>
  </Transition>
</template>

<script setup>
/**
 * Модалка для работы с объектом, отсутствующим в ведомости (isExcess).
 * Открывается из InvListModal при клике на объект в синей строке.
 */

const props = defineProps({
  /**
   * Флаг открытия модалки
   */
  isOpen: {
    type: Boolean,
    required: true
  },
  /**
   * ID объекта
   */
  objectId: {
    type: [Number, String],
    required: true
  }
})

const emit = defineEmits(['back'])

/**
 * Возврат к InvListModal
 */
const handleBack = () => {
  emit('back')
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s cubic-bezier(0.2, 0.9, 0.4, 1.1);
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95) translateY(-5px);
}
</style>