<template>
  <Transition name="modal">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
      @click.self="handleOverlayClick"
    >
      <div
        class="modal-container bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style="width: 95vw; max-width: 520px; max-height: 90vh"
      >
        <!-- Хедер -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 class="text-lg font-semibold text-gray-900">
            Игнор-слова
            <span v-if="keywords.length > 0" class="text-sm font-normal text-gray-400 ml-2">({{ keywords.length }})</span>
          </h3>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 text-2xl
                   active:bg-gray-100 active:text-gray-900"
            @click="handleCancel"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <!-- Состояние загрузки -->
        <div v-if="isLoading" class="flex-1 flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
          <div class="w-10 h-10 border-[3px] border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
          <p class="text-sm">Загрузка...</p>
        </div>

        <!-- Состояние ошибки -->
        <div v-else-if="error" class="flex-1 flex flex-col items-center justify-center py-16 text-red-600 gap-4 px-5">
          <p class="text-sm text-center">{{ error }}</p>
          <button
            @click="loadKeywords"
            class="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium active:bg-red-600"
          >
            Повторить
          </button>
        </div>

        <!-- Основной контент -->
        <template v-else>
          <!-- Кнопка добавления -->
          <div class="px-5 pt-4 pb-2 shrink-0">
            <button
              @click="handleAddKeyword"
              class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600
                     bg-blue-50 rounded-lg active:bg-blue-100 transition"
            >
              <span class="text-lg leading-none">+</span>
              <span>Добавить</span>
            </button>
          </div>

          <!-- Список слов -->
          <div class="flex-1 overflow-y-auto min-h-0 px-5 pb-2">
            <div v-if="keywords.length === 0" class="py-12 text-center text-gray-400 text-sm italic">
              Список пуст. Добавьте ключевые слова для автоматической фильтрации ведомостей.
            </div>

            <div v-else class="space-y-1">
              <div
                v-for="(kw, index) in keywords"
                :key="kw._localId"
                class="flex items-center gap-2 py-1.5"
              >
                <!-- Номер строки -->
                <span class="text-xs text-gray-400 w-6 text-right shrink-0 select-none">
                  {{ index + 1 }}
                </span>

                <!-- Редактируемое поле -->
                <input
                  ref="inputRefs"
                  v-model="kw.keyword"
                  type="text"
                  :class="[
                    'flex-1 px-2 py-1.5 text-sm border rounded-md outline-none transition',
                    kw._error
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-gray-200 bg-white text-gray-800 focus:border-blue-400 focus:ring-1 focus:ring-blue-400'
                  ]"
                  placeholder="Введите слово"
                  @input="handleKeywordInput(kw)"
                  @keydown.enter.prevent="handleKeywordEnter($event, index)"
                  @blur="handleKeywordBlur(kw)"
                />

                <!-- Кнопка удаления -->
                <button
                  @click="handleRemoveKeyword(index)"
                  class="w-7 h-7 flex items-center justify-center rounded-md
                         text-gray-400 hover:text-red-500 active:bg-red-50 active:text-red-600
                         transition shrink-0"
                  title="Удалить слово"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          <!-- Предупреждение -->
          <div v-if="hasChanges" class="px-5 pt-2 shrink-0">
            <div class="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <span class="text-amber-500 text-lg leading-none shrink-0">⚠</span>
              <p class="text-xs text-amber-700">
                При применении все ручные отметки актуальности в ведомостях будут сброшены,
                и пересчитаны заново по новому списку игнор-слов.
              </p>
            </div>
          </div>

          <!-- Футер с кнопками -->
          <div class="px-5 py-4 border-t border-gray-100 bg-gray-50 shrink-0 flex gap-3">
            <button
              @click="handleCancel"
              class="flex-1 py-2.5 rounded-lg text-sm font-medium transition
                     bg-white border border-gray-300 text-gray-700 active:bg-gray-100"
            >
              Отмена
            </button>
            <button
              @click="handleApply"
              :disabled="isApplying || !hasChanges || hasErrors"
              :class="[
                'flex-1 py-2.5 rounded-lg text-sm font-medium transition',
                isApplying || !hasChanges || hasErrors
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-900 text-white active:bg-black'
              ]"
            >
              {{ isApplying ? 'Применение...' : 'Применить' }}
            </button>
          </div>
          <p v-if="applyResult" class="px-5 pb-4 text-xs text-green-600 text-center">
            {{ applyResult }}
          </p>
        </template>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { molService } from '@/services/mol.service'

// ============================================================================
// ПРОПСЫ И ЭМИТЫ
// ============================================================================

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['close'])

// ============================================================================
// СОСТОЯНИЕ
// ============================================================================

const isLoading = ref(false)
const isApplying = ref(false)
const error = ref(null)
const applyResult = ref(null)

/**
 * Список игнор-слов с локальными мета-полями.
 * @type {Array<{_localId: string, id: number, keyword: string, _original: string, _error: string|null}>}
 */
const keywords = ref([])

/** Исходный список слов (строки) до редактирования — для сравнения */
const originalKeywordsSnapshot = ref([])

/** Ссылки на инпуты для управления фокусом */
const inputRefs = ref([])

// ============================================================================
// ВЫЧИСЛЯЕМЫЕ СВОЙСТВА
// ============================================================================

/** Есть ли несохранённые изменения */
const hasChanges = computed(() => {
  const current = keywords.value.map(k => k.keyword.trim()).filter(k => k.length > 0)
  const orig = originalKeywordsSnapshot.value.slice().sort()
  const curr = current.slice().sort()

  if (orig.length !== curr.length) return true
  return orig.some((val, i) => val !== curr[i])
})

/** Есть ли ошибки валидации */
const hasErrors = computed(() => {
  return keywords.value.some(k => k._error !== null)
})

// ============================================================================
// УТИЛИТЫ ВАЛИДАЦИИ
// ============================================================================

/**
 * Валидирует одно ключевое слово.
 * @param {string} keyword — значение поля
 * @param {Array} allKeywords — все ключевые слова для проверки дубликатов
 * @param {string} currentLocalId — _localId текущей записи
 * @returns {string|null} текст ошибки или null
 */
const validateKeyword = (keyword, allKeywords, currentLocalId) => {
  const trimmed = keyword.trim()

  if (keyword.length > 0 && trimmed.length === 0) {
    return 'Слово не может состоять только из пробелов'
  }

  if (trimmed.length > 0) {
    const duplicate = allKeywords.find(
      k => k._localId !== currentLocalId && k.keyword.trim() === trimmed
    )
    if (duplicate) {
      return 'Такое слово уже есть в списке'
    }
  }

  return null
}

// ============================================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================================

/**
 * Загружает список игнор-слов.
 */
const loadKeywords = async () => {
  isLoading.value = true
  error.value = null
  applyResult.value = null

  try {
    const data = await molService.getIgnoreKeywords()

    keywords.value = data.map(k => ({
      _localId: crypto.randomUUID ? crypto.randomUUID() : `kw_${Date.now()}_${Math.random()}`,
      id: k.id,
      keyword: k.keyword || '',
      _original: k.keyword || '',
      _error: null
    }))

    originalKeywordsSnapshot.value = data.map(k => k.keyword || '')
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки игнор-слов'
    console.error('[IgnoreKeywordsModal]', e)
  } finally {
    isLoading.value = false
  }
}

// ============================================================================
// ОБРАБОТЧИКИ РЕДАКТИРОВАНИЯ
// ============================================================================

/**
 * Обработчик ввода в поле слова.
 * @param {Object} kw — запись ключевого слова
 */
const handleKeywordInput = (kw) => {
  kw._error = validateKeyword(kw.keyword, keywords.value, kw._localId)
}

/**
 * Обработчик нажатия Enter на поле слова.
 * Завершает ввод: если поле не пустое и не последнее — создаёт новую строку и фокусирует её.
 * Если последнее и не пустое — просто снимает фокус.
 * @param {KeyboardEvent} event
 * @param {number} index — индекс в массиве keywords
 */
const handleKeywordEnter = (event, index) => {
  const current = keywords.value[index]
  const trimmed = current.keyword.trim()

  // Снимаем фокус с текущего поля
  event.target.blur()

  // Если поле не пустое и это последняя строка — добавляем новую
  if (trimmed.length > 0 && index === keywords.value.length - 1) {
    handleAddKeyword()
    // Фокусируем новое поле после обновления DOM
    nextTick(() => {
      const inputs = document.querySelectorAll('.modal-container input[type="text"]')
      const lastInput = inputs[inputs.length - 1]
      if (lastInput) lastInput.focus()
    })
  }
}

/**
 * Обработчик потери фокуса с поля слова.
 * Если поле пустое и не единственное — удаляет запись.
 * @param {Object} kw — запись ключевого слова
 */
const handleKeywordBlur = (kw) => {
  kw._error = validateKeyword(kw.keyword, keywords.value, kw._localId)

  const trimmed = kw.keyword.trim()
  if (trimmed.length === 0 && keywords.value.length > 1) {
    const index = keywords.value.findIndex(k => k._localId === kw._localId)
    if (index !== -1) {
      keywords.value.splice(index, 1)
    }
  }
}

/**
 * Добавляет новую пустую строку в список.
 */
const handleAddKeyword = () => {
  keywords.value.push({
    _localId: crypto.randomUUID ? crypto.randomUUID() : `kw_${Date.now()}_${Math.random()}`,
    id: null,
    keyword: '',
    _original: '',
    _error: null
  })
}

/**
 * Удаляет слово из списка по индексу.
 * @param {number} index — индекс в массиве keywords
 */
const handleRemoveKeyword = (index) => {
  if (keywords.value.length <= 1) {
    keywords.value[0].keyword = ''
    keywords.value[0]._error = null
    return
  }
  keywords.value.splice(index, 1)
}

// ============================================================================
// ПРИМЕНЕНИЕ ИЗМЕНЕНИЙ
// ============================================================================

/**
 * Применяет изменения: заменяет список игнор-слов и пересчитывает ведомости.
 */
const handleApply = async () => {
  if (!hasChanges.value || isApplying.value || hasErrors.value) return

  isApplying.value = true
  applyResult.value = null
  error.value = null

  try {
    const newKeywords = keywords.value
      .map(k => k.keyword.trim())
      .filter(k => k.length > 0)

    if (molService.isFlightMode()) {
      await molService.replaceAndApplyIgnoreKeywords(newKeywords)
    } else {
      const token = localStorage.getItem('auth_token')
      if (!token) throw new Error('Токен авторизации не найден')

      const response = await fetch('/api/mol/ignore-keywords/replace-and-apply', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ keywords: newKeywords })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }

      const result = await response.json()
      applyResult.value = result.message || `Обновлено ${result.updatedCount || 0} записей`
    }

    // Закрываем модалку после небольшой задержки
    setTimeout(() => {
      emit('close')
    }, 800)
  } catch (e) {
    error.value = e.message || 'Ошибка применения изменений'
    console.error('[IgnoreKeywordsModal]', e)
  } finally {
    isApplying.value = false
  }
}

// ============================================================================
// ОТМЕНА
// ============================================================================

/**
 * Закрывает модалку без сохранения.
 */
const handleCancel = () => {
  emit('close')
}

// ============================================================================
// ЗАКРЫТИЕ ПО ОВЕРЛЕЮ
// ============================================================================

/**
 * Закрытие по клику на оверлей — тоже без сохранения.
 */
const handleOverlayClick = () => {
  emit('close')
}

// ============================================================================
// НАБЛЮДЕНИЕ ЗА ОТКРЫТИЕМ
// ============================================================================

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    loadKeywords()
  }
})
</script>

<style scoped>
/* Анимация модалки */
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