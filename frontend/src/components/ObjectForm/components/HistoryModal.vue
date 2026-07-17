<template>
  <Transition name="modal">
    <div v-if="isOpen" class="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50" @click.self="handleClose">
      <div class="modal-container bg-white w-full h-full flex flex-col">
        <!-- Заголовок -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-800">История объекта</h2>
          <button 
            class="w-8 h-8 rounded-full flex items-center justify-center text-gray-500
                   active:bg-gray-100"
            @click="handleClose"
          >
            ×
          </button>
        </div>

        <!-- Контент -->
        <div class="flex-1 overflow-y-auto p-4">
          <!-- Загрузка -->
          <div v-if="isLoading" class="py-10 text-center text-gray-500">
            Загрузка истории...
          </div>

          <!-- Ошибка -->
          <div v-else-if="error" class="py-10 text-center text-red-600">
            <p>{{ error }}</p>
            <button 
              @click="loadHistory" 
              class="mt-4 px-4 py-2 bg-red-500 text-white rounded-md text-sm font-medium
                     active:bg-red-600"
            >
              Повторить
            </button>
          </div>

          <!-- Список событий -->
          <div v-else class="flex flex-col gap-3">
            <div 
              v-for="entry in historyEntries" 
              :key="entry.id" 
              class="flex gap-3 p-3 rounded-lg"
              :class="getEventRowClass(entry.eventType)"
            >
              <!-- Иконка типа события -->
              <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm"
                   :class="getEventIconClass(entry.eventType)"
              >
                {{ getEventIcon(entry.eventType) }}
              </div>

              <!-- Содержимое -->
              <div class="flex-1 min-w-0">
                <div class="text-[15px] text-gray-800 leading-snug break-words">
                  {{ entry.storyLine }}
                </div>
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-[13px] text-gray-400">{{ formatDate(entry.time) }}</span>
                  <span v-if="entry.userAbr" class="text-[13px] text-blue-500 font-medium">{{ entry.userAbr }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Футер -->
        <div class="p-4 border-t border-gray-200 bg-white">
          <button 
            @click="handleClose"
            class="w-full py-3 rounded-lg text-base font-medium transition
                   bg-gray-900 text-white active:bg-black"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch } from 'vue'
import { logsService } from '@/services/logs.service'

const props = defineProps({
  isOpen: Boolean,
  objectId: [Number, String, null]
})

const emit = defineEmits(['close'])

const isLoading = ref(false)
const error = ref(null)
const historyEntries = ref([])

/**
 * Форматирует дату для отображения.
 * @param {string|Date} date - дата события
 * @returns {string} отформатированная дата ДД.ММ.ГГГГ ЧЧ:ММ
 */
const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day}.${month}.${year} ${hours}:${minutes}`
}

/**
 * Возвращает emoji-иконку для типа события.
 * @param {string} eventType - тип события
 * @returns {string} emoji
 */
const getEventIcon = (eventType) => {
  switch (eventType) {
    case 'created': return '✅'
    case 'place_changed': return '🚚'
    case 'sn_changed': return '🏷️'
    case 'comment': return '💬'
    case 'checked': return '✅'
    default: return '📋'
  }
}

/**
 * Возвращает CSS-класс для иконки типа события.
 * @param {string} eventType - тип события
 * @returns {string} CSS-класс
 */
const getEventIconClass = (eventType) => {
  switch (eventType) {
    case 'created': return 'bg-green-100 text-green-700'
    case 'place_changed': return 'bg-red-100 text-red-400'
    case 'sn_changed': return 'bg-yellow-100 text-yellow-700'
    case 'comment': return 'bg-blue-100 text-blue-700'
    case 'checked': return 'bg-green-100 text-green-700'
    default: return 'bg-gray-100 text-gray-600'
  }
}

/**
 * Возвращает CSS-класс для строки события.
 * @param {string} eventType - тип события
 * @returns {string} CSS-класс фона строки
 */
const getEventRowClass = (eventType) => {
  switch (eventType) {
    case 'created': return 'bg-green-50'
    case 'place_changed': return 'bg-red-50'
    case 'sn_changed': return 'bg-yellow-50'
    case 'comment': return 'bg-gray-50'
    case 'checked': return 'bg-green-50'
    default: return 'bg-gray-50'
  }
}

/**
 * Загружает историю объекта.
 * Нормализует формат данных из онлайн и офлайн источников.
 */
const loadHistory = async () => {
  if (!props.objectId) {
    error.value = 'ID объекта не указан'
    return
  }

  isLoading.value = true
  error.value = null

  try {
    const rawHistory = await logsService.getObjectHistory(props.objectId)
    
    // Нормализация формата: онлайн и офлайн могут отличаться
    historyEntries.value = rawHistory.map(entry => {
      // Онлайн формат: { id, time, eventType, storyLine, userAbr }
      if (entry.eventType && entry.storyLine) {
        return entry
      }
      // Офлайн формат: { id, source, time, content: { eventType, storyLine } }
      if (entry.content) {
        return {
          id: entry.id || entry.time,
          time: entry.time,
          eventType: entry.content.eventType || 'unknown',
          storyLine: entry.content.storyLine || '',
          userAbr: null
        }
      }
      return entry
    }).reverse() // сперва новые

    if (historyEntries.value.length === 0) {
      error.value = 'История не найдена'
    }
  } catch (err) {
    console.error('[HistoryModal] Ошибка загрузки истории:', err)
    error.value = `Ошибка загрузки: ${err.message}`
  } finally {
    isLoading.value = false
  }
}

const handleClose = () => {
  emit('close')
}

// Загружаем историю при открытии модалки
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    loadHistory()
  }
})
</script>

<style scoped>
/* Анимация появления/исчезновения модалки */
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