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


// --- Инициализация и синхронизация состояния ---

const focusSearchInput = () => {
  if (searchInput.value) {
    nextTick(() => {
      searchInput.value.focus()
    })
  }
}

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    originalSelected.value = [...props.selectedValues]
    
    if (props.selectedValues.length === 0) {
      // Если проп пуст, выбираем ВСЕ опции по умолчанию
      internalSelected.value = [...props.options.map(opt => opt.value)]
    } else {
      internalSelected.value = [...props.selectedValues]
    }
    
    searchQuery.value = '' 
    focusSearchInput() 
  }
}, { immediate: true })


// --- Методы поиска (Реальное время) ---

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

// *** КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Ручное обновление searchQuery ***
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
  emit('apply', [...internalSelected.value])
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