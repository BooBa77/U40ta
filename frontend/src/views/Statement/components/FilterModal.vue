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
          type="search"
          v-model="searchQuery"
          :placeholder="searchPlaceholder"
          class="search-input"
          enterkeyhint="search"
          @keydown.enter="handleEnterKey"
          @input="handleSearchInput"
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
            <span class="checkbox-text">{{ option.label }}</span>
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
import { ref, computed, watch, nextTick } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import './FilterModal.css'

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

// computed для отфильтрованных опций
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

// --- Инициализация и синхронизация состояния ---

const focusSearchInput = () => {
  if (searchInput.value) {
    nextTick(() => {
      searchInput.value.focus()
    })
  }
}

watch(() => props.selectedValues, (newValues) => {
  console.log('[FILTER-MODAL] 1. Получены props.selectedValues:', {
    newValues,
    type: typeof newValues,
    isArray: Array.isArray(newValues),
    isRef: newValues && typeof newValues === 'object' && 'value' in newValues,
    hasValue: newValues?.value !== undefined
  })
  
  // Проверка: если это ref, берем .value
  let valuesToUse = newValues
  if (newValues && typeof newValues === 'object' && 'value' in newValues) {
    console.log('[FILTER-MODAL] 2. Это ref, берем .value:', newValues.value)
    valuesToUse = newValues.value
  }
  
  // Защита от неитерируемых значений
  if (!valuesToUse || !Array.isArray(valuesToUse)) {
    console.warn('[FILTER-MODAL] 3. ОШИБКА: valuesToUse не массив, использую пустой:', valuesToUse)
    internalSelected.value = []
    return
  }
  
  console.log('[FILTER-MODAL] 4. Устанавливаю internalSelected:', valuesToUse)
  internalSelected.value = [...valuesToUse]
}, { immediate: true })

// Ручное обновление searchQuery
const handleSearchInput = (event) => {
    searchQuery.value = event.target.value; // Немедленное обновление реактивной переменной
}

const handleEnterKey = () => {
  searchInput.value?.blur() 
}

// --- Методы выбора ---

const isOptionSelected = (value) => {
  return internalSelected.value.includes(value)
}

const toggleOption = (value) => {
  const index = internalSelected.value.indexOf(value)
  if (index === -1) {
    internalSelected.value.push(value)
  } else {
    internalSelected.value.splice(index, 1)
  }
}

const selectAllFiltered = () => {
  const filteredValues = filteredOptions.value.map(option => option.value)
  internalSelected.value = [...new Set([...internalSelected.value, ...filteredValues])]
}

const deselectAll = () => {
  const filteredValues = filteredOptions.value.map(option => option.value)
  internalSelected.value = internalSelected.value.filter(val => !filteredValues.includes(val))
}

// --- Обработчики кнопок ---

const handleApply = () => {
  // Фильтруем выбранные значения - оставляем только те, что видны в текущем поиске
  const visibleSelectedValues = internalSelected.value.filter(value => 
    filteredOptions.value.some(option => option.value === value)
  )
  
  console.log('Applying filter - видимые выбранные:', visibleSelectedValues)
  console.log('Все выбранные:', internalSelected.value)
  
  emit('apply', [...visibleSelectedValues])
}

const handleReset = () => {
  internalSelected.value = []
  searchQuery.value = ''
  emit('reset')
}

const handleCancel = () => {
  internalSelected.value = [...originalSelected.value]
  searchQuery.value = ''
  emit('close')
}

const handleClose = () => {
  handleCancel()
}
</script>

<style scoped>
@import './FilterModal.css';
</style>