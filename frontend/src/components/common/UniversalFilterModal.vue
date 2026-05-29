<template>
  <Transition name="modal">
    <div v-if="isOpen" class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" @click.self="handleClose">
      <div class="modal-container bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden" :style="{ width: width, maxWidth: maxWidth, maxHeight: '85vh' }">
        
        <!-- Хедер -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 class="text-lg font-semibold text-gray-900">{{ title }}</h3>
          <button 
            class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 text-2xl
                   active:bg-gray-100 active:text-gray-900"
            @click="handleClose"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <!-- Контент -->
        <div class="overflow-y-auto flex-1 p-5">
          <div class="flex flex-col gap-4 min-h-[200px]">
            <!-- Поле поиска -->
            <div v-if="showSearch">
              <input
                ref="searchInput"
                type="search"
                v-model="searchQuery"
                :placeholder="searchPlaceholder"
                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                       focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10
                       disabled:bg-gray-100"
                @input="handleSearchInput"
                @keydown.enter="handleEnterKey"
              />
            </div>
            
            <!-- Загрузка -->
            <div v-if="isLoading" class="flex flex-col items-center justify-center py-10 text-gray-500 gap-3">
              <div class="w-10 h-10 border-[3px] border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
              <p class="text-sm">Загрузка...</p>
            </div>
            
            <!-- Список опций -->
            <div v-else class="flex flex-col gap-2 max-h-[300px] overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
              
              <div 
                v-for="option in filteredOptions" 
                :key="getOptionValue(option)"
                class="flex items-start gap-3 p-3 rounded min-h-[44px] active:bg-gray-100"
              >
                <input
                  type="checkbox"
                  :id="`filter-${getOptionValue(option)}`"
                  :checked="isSelected(getOptionValue(option))"
                  @change="toggleOption(getOptionValue(option))"
                  class="w-4 h-4 accent-blue-500 shrink-0 mt-1"
                />
                <label 
                  :for="`filter-${getOptionValue(option)}`"
                  class="flex-1 flex items-start gap-3 text-sm text-gray-700 min-w-0"
                >
                  <span class="flex-1 break-words">{{ getOptionLabel(option) }}</span>
                  <span v-if="showCount && getOptionCount(option)" class="text-xs text-gray-500 whitespace-nowrap shrink-0">
                    ({{ getOptionCount(option) }})
                  </span>
                </label>
              </div>
              
              <div v-if="filteredOptions.length === 0 && searchQuery" class="text-center py-8 text-gray-500 italic text-sm">
                Ничего не найдено по запросу "{{ searchQuery }}"
              </div>
              
              <div v-if="filteredOptions.length === 0 && !searchQuery && !isLoading" class="text-center py-8 text-gray-500 italic text-sm">
                Нет данных для фильтрации
              </div>
            </div>
            
            <!-- Кнопки массового выбора -->
            <div v-if="showBulkActions && !isLoading && filteredOptions.length > 0" class="flex gap-2 pt-2 border-t border-gray-200">
              <button 
                @click="selectAllFiltered" 
                class="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md text-sm font-medium
                       active:bg-gray-300"
              >
                Выбрать все
              </button>
              <button 
                @click="deselectAll" 
                class="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md text-sm font-medium
                       active:bg-gray-300"
              >
                Снять все
              </button>
            </div>
          </div>
        </div>

        <!-- Футер -->
        <div class="flex justify-end gap-2 p-3 border-t border-gray-100 bg-gray-50 shrink-0">
          <button 
            @click="handleClose" 
            class="px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium
                   active:bg-gray-100"
          >
            Отмена
          </button>
          <button 
            @click="handleApply" 
            class="px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold
                   active:bg-black
                   disabled:opacity-50"
            :disabled="isLoading"
          >
            Применить
          </button>
        </div>

      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

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
    default: () => []
  },
  selectedValues: {
    type: Array,
    default: () => []
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  showSearch: {
    type: Boolean,
    default: true
  },
  showCount: {
    type: Boolean,
    default: true
  },
  showBulkActions: {
    type: Boolean,
    default: true
  },
  searchPlaceholder: {
    type: String,
    default: 'Поиск...'
  },
  valueKey: {
    type: String,
    default: 'value'
  },
  labelKey: {
    type: String,
    default: 'label'
  },
  countKey: {
    type: String,
    default: 'count'
  },
  width: {
    type: String,
    default: '500px'
  },
  maxWidth: {
    type: String,
    default: '500px'
  },
  filterFn: {
    type: Function,
    default: (option, query, valueKey, labelKey) => {
      const value = String(option[valueKey] || '').toLowerCase()
      const label = String(option[labelKey] || '').toLowerCase()
      const search = query.toLowerCase()
      return value.includes(search) || label.includes(search)
    }
  }
})

const emit = defineEmits(['apply', 'close', 'reset'])

const searchQuery = ref('')
const internalSelected = ref([])
const searchInput = ref(null)

const getOptionValue = (option) => option[props.valueKey]
const getOptionLabel = (option) => option[props.labelKey]
const getOptionCount = (option) => option[props.countKey]

const filteredOptions = computed(() => {
  if (!props.showSearch || !searchQuery.value.trim()) {
    return props.options
  }
  
  return props.options.filter(option => 
    props.filterFn(option, searchQuery.value, props.valueKey, props.labelKey)
  )
})

const isSelected = (value) => internalSelected.value.includes(value)

const toggleOption = (value) => {
  const index = internalSelected.value.indexOf(value)
  if (index === -1) {
    internalSelected.value.push(value)
  } else {
    internalSelected.value.splice(index, 1)
  }
}

const selectAllFiltered = () => {
  const filteredValues = filteredOptions.value.map(getOptionValue)
  internalSelected.value = [...new Set([...internalSelected.value, ...filteredValues])]
}

const deselectAll = () => {
  const filteredValues = filteredOptions.value.map(getOptionValue)
  internalSelected.value = internalSelected.value.filter(v => !filteredValues.includes(v))
}

const handleApply = () => {
  emit('apply', [...internalSelected.value])
}

const handleReset = () => {
  internalSelected.value = []
  searchQuery.value = ''
  emit('reset')
}

const handleClose = () => {
  searchQuery.value = ''
  emit('close')
}

watch(() => props.selectedValues, (newValues) => {
  internalSelected.value = [...(newValues || [])]
}, { immediate: true })

watch(() => props.isOpen, (isOpen) => {
  searchQuery.value = ''
  if (isOpen && props.showSearch) {
    nextTick(() => {
      searchInput.value?.focus()
    })
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