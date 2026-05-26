<template>
  <BaseModal
    :is-open="isOpen"
    :title="title"
    :width="width"
    :max-width="maxWidth"
    @close="handleClose"
  >
    <div class="flex flex-col gap-4 min-h-[200px]">
      <!-- Поле поиска -->
      <div v-if="showSearch">
        <input
          ref="searchInput"
          type="search"
          v-model="searchQuery"
          :placeholder="searchPlaceholder"
          class="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
          @input="handleSearchInput"
          @keydown.enter="handleEnterKey"
        />
      </div>
      
      <!-- Загрузка -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-10 px-5 text-gray-500 gap-3">
        <div class="w-10 h-10 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
        <p class="text-sm">Загрузка...</p>
      </div>
      
      <!-- Список опций -->
      <div v-else class="flex flex-col gap-2 max-h-[300px] overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
        
        <div 
          v-for="option in filteredOptions" 
          :key="getOptionValue(option)"
          class="flex items-start gap-3 p-3 rounded min-h-[44px] hover:bg-gray-100 transition"
        >
          <input
            type="checkbox"
            :id="`filter-${getOptionValue(option)}`"
            :checked="isSelected(getOptionValue(option))"
            @change="toggleOption(getOptionValue(option))"
            class="w-4 h-4 accent-blue-500 flex-shrink-0 mt-1 cursor-pointer"
          />
          <label 
            :for="`filter-${getOptionValue(option)}`"
            class="flex-1 flex items-start gap-3 text-sm text-gray-700 cursor-pointer min-w-0"
          >
            <span class="flex-1 break-words whitespace-normal">{{ getOptionLabel(option) }}</span>
            <span v-if="showCount && getOptionCount(option)" class="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
              ({{ getOptionCount(option) }})
            </span>
          </label>
        </div>
        
        <div v-if="filteredOptions.length === 0 && searchQuery" class="text-center py-8 px-5 text-gray-500 italic text-sm">
          Ничего не найдено по запросу "{{ searchQuery }}"
        </div>
        
        <div v-if="filteredOptions.length === 0 && !searchQuery && !isLoading" class="text-center py-8 px-5 text-gray-500 italic text-sm">
          Нет данных для фильтрации
        </div>
      </div>
      
      <!-- Кнопки массового выбора -->
      <div v-if="showBulkActions && !isLoading && filteredOptions.length > 0" class="flex gap-2 pt-2 border-t border-gray-200">
        <button @click="selectAllFiltered" class="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition">
          Выбрать все
        </button>
        <button @click="deselectAll" class="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition">
          Снять все
        </button>
      </div>
    </div>
    
    <!-- Футер -->
    <template #footer>
      <button 
        @click="handleClose" 
        class="border border-gray-300 text-gray-600 font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition"
      >
        Отмена
      </button>
      <button 
        @click="handleApply" 
        class="bg-gray-900 text-white font-semibold px-4 py-2 rounded-lg hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="isLoading"
      >
        Применить
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
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
  searchQuery.value = '' // Очистка поля
  if (isOpen && props.showSearch) {
    nextTick(() => {
      searchInput.value?.focus()
    })
  }
})
</script>