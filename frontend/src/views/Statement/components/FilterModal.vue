<template>
  <BaseModal
    :is-open="isOpen"
    :title="title"
    :width="modalWidth"
    :max-width="modalMaxWidth"
    @close="handleClose"
  >
    <div class="filter-modal-content">
      <!-- Поле поиска -->
      <div class="search-section" v-if="showSearch">
        <input
          ref="searchInput"
          type="text" <!-- Изменено с search на text -->
          v-model="searchQuery"
          :placeholder="searchPlaceholder"
          class="search-input"
          enterkeyhint="done" <!-- Изменено с search на done -->
          @input="handleSearchInput"
          @keydown.enter="handleEnterKey"
          @keyup="handleSearchInput" <!-- Добавлено для мобильных устройств -->
        />
      </div>
      
      <!-- Состояние загрузки -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Загрузка данных...</p>
      </div>
      
      <!-- Список чекбоксов -->
      <div v-else class="checkbox-list">
        <div 
          v-for="option in filteredOptions" 
          :key="option.value"
          class="checkbox-item"
          @click="toggleOption(option.value)"
        >
          <input
            type="checkbox"
            :id="'filter-option-' + option.value"
            :checked="isOptionSelected(option.value)"
            @change="toggleOption(option.value)"
            class="checkbox-input"
          />
          <label 
            :for="'filter-option-' + option.value"
            class="checkbox-label"
          >
            {{ option.label }}
            <span class="option-count" v-if="option.count">({{ option.count }})</span>
          </label>
        </div>
        
        <!-- Сообщение если ничего не найдено -->
        <div v-if="filteredOptions.length === 0 && searchQuery" class="no-results">
          Ничего не найдено по запросу "{{ searchQuery }}"
        </div>
        
        <!-- Сообщение если список пуст -->
        <div v-if="filteredOptions.length === 0 && !searchQuery && !isLoading" class="empty-list">
          Нет данных для фильтрации
        </div>
      </div>
      
      <!-- Кнопки массового выбора -->
      <div class="bulk-actions" v-if="!isLoading && filteredOptions.length > 0">
        <button @click="selectAllFiltered" class="bulk-btn">
          Выбрать все видимые
        </button>
        <button @click="deselectAll" class="bulk-btn">
          Снять все
        </button>
      </div>
    </div>
    
    <!-- Футер с кнопками действий -->
    <template #footer>
      <button @click="handleReset" class="btn btn-secondary">
        Сбросить
      </button>
      <button @click="handleCancel" class="btn btn-cancel">
        Отмена
      </button>
      <button @click="handleApply" class="btn btn-primary" :disabled="isLoading">
        Применить
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted, onMounted } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  options: {
    type: Array,
    default: () => [] // массив {value, label, count?}
  },
  selectedValues: {
    type: Array,
    default: () => [] // массив выбранных значений
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  searchPlaceholder: {
    type: String,
    default: 'Поиск в списке...'
  },
  modalWidth: {
    type: String,
    default: '500px'
  },
  modalMaxWidth: {
    type: String,
    default: '500px'
  },
  showSearch: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['close', 'apply', 'reset'])

// Локальное состояние
const searchQuery = ref('')
const internalSelected = ref([])
const originalSelected = ref([])
const searchInput = ref(null)
let searchTimeout = null

// Отфильтрованные опции по поиску
const filteredOptions = computed(() => {
  if (!searchQuery.value.trim()) {
    return props.options
  }
  
  const query = searchQuery.value.toLowerCase()
  return props.options.filter(option => 
    String(option.label).toLowerCase().includes(query) ||
    String(option.value).toLowerCase().includes(query)
  )
})

// Обработка ввода (с debounce 150ms для более быстрого отклика)
const handleSearchInput = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    // Фильтрация происходит автоматически через computed свойство
    // Для мобильных устройств дополнительно скроллим к началу списка
    if (searchInput.value && document.activeElement === searchInput.value) {
      // В мобильных браузерах может потребоваться небольшой таймаут для корректной работы
      setTimeout(() => {
        const listElement = document.querySelector('.checkbox-list')
        if (listElement) {
          listElement.scrollTop = 0
        }
      }, 10)
    }
  }, 150)
}

// Нажатие Enter (на мобильных "Готово")
const handleEnterKey = (event) => {
  clearTimeout(searchTimeout)
  event.target?.blur() // Скрываем клавиатуру
  // Не вызываем performSearchFilter, так как фильтрация уже работает в реальном времени
}

// Проверка выбрана ли опция
const isOptionSelected = (value) => {
  return internalSelected.value.includes(value)
}

// Переключение выбора опции
const toggleOption = (value) => {
  const index = internalSelected.value.indexOf(value)
  if (index === -1) {
    internalSelected.value.push(value)
  } else {
    internalSelected.value.splice(index, 1)
  }
}

// Выбрать все отфильтрованные
const selectAllFiltered = () => {
  const filteredValues = filteredOptions.value.map(option => option.value)
  internalSelected.value = [...new Set([...internalSelected.value, ...filteredValues])]
}

// Снять все
const deselectAll = () => {
  internalSelected.value = []
}

// Обработчики действий
const handleApply = () => {
  emit('apply', [...internalSelected.value])
}

const handleReset = () => {
  internalSelected.value = []
  searchQuery.value = ''
  emit('reset')
}

const handleCancel = () => {
  // Возвращаем исходное состояние при отмене
  internalSelected.value = [...originalSelected.value]
  searchQuery.value = ''
  emit('close')
}

const handleClose = () => {
  handleCancel()
}

// Фокус на поле поиска при открытии
const focusSearchInput = () => {
  if (searchInput.value) {
    nextTick(() => {
      searchInput.value.focus()
      // На мобильных устройствах иногда нужно небольшое ожидание для корректного фокуса
      setTimeout(() => {
        if (searchInput.value) {
          searchInput.value.focus()
        }
      }, 50)
    })
  }
}

// Инициализация при открытии
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    // Сохраняем исходное состояние
    originalSelected.value = [...props.selectedValues]
    
    // Если при открытии selectedValues пустые, выбираем ВСЕ опции
    if (props.selectedValues.length === 0) {
      internalSelected.value = [...props.options.map(opt => opt.value)]
    } else {
      internalSelected.value = [...props.selectedValues]
    }
    
    searchQuery.value = ''
    focusSearchInput()
  }
}, { immediate: true })

// Очистка при размонтировании
onUnmounted(() => {
  clearTimeout(searchTimeout)
})
</script>

<style scoped>
/* Существующие стили остаются без изменений */
.filter-modal-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 200px;
}

.search-section {
  margin-bottom: 8px;
}

.search-input {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s;
  box-sizing: border-box;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #6b7280;
  gap: 12px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.checkbox-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background-color: #f9fafb;
}

.checkbox-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: default;
  transition: background-color 0.2s;
  user-select: none;
}

.checkbox-item:hover {
  background-color: #f3f4f6;
}

.checkbox-input {
  margin-right: 12px;
  cursor: pointer;
  width: 18px;
  height: 18px;
  accent-color: #3b82f6;
  pointer-events: auto;
}

.checkbox-label {
  flex-grow: 1;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  line-height: 1.4;
  word-break: break-word;
  pointer-events: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.option-count {
  font-size: 12px;
  color: #6b7280;
  margin-left: 8px;
}

.no-results,
.empty-list {
  text-align: center;
  padding: 20px;
  color: #6b7280;
  font-style: italic;
}

.bulk-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #e5e7eb;
}

.bulk-btn {
  padding: 6px 12px;
  background-color: #e5e7eb;
  color: #374151;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.bulk-btn:hover {
  background-color: #d1d5db;
}

/* Стили для кнопок в футере */
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 80px;
}

.btn-primary {
  background-color: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.btn-primary:disabled {
  background-color: #93c5fd;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background-color: #4b5563;
}

.btn-cancel {
  background-color: transparent;
  color: #6b7280;
  border: 1px solid #d1d5db;
}

.btn-cancel:hover {
  background-color: #f3f4f6;
}

/* Адаптивность */
@media (max-width: 768px) {
  .filter-modal-content {
    min-height: 150px;
  }
  
  .checkbox-list {
    max-height: 250px;
  }
  
  .btn {
    min-width: 70px;
    padding: 8px 12px;
    font-size: 13px;
  }
  
  /* Улучшение для мобильных устройств */
  .search-input {
    font-size: 16px; /* Увеличиваем для лучшей читаемости на мобильных */
    padding: 12px 14px;
  }
  
  .checkbox-item {
    padding: 10px 14px;
  }
  
  .checkbox-label {
    font-size: 15px; /* Чуть больше текст на мобильных */
  }
}

/* Кастомный скроллбар */
.checkbox-list::-webkit-scrollbar {
  width: 6px;
}

.checkbox-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.checkbox-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.checkbox-list::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>