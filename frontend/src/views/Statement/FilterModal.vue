<!-- FilterModal.vue -->
<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal" :class="{ 'wide-modal': filterType === 'multiselect' }">
      <div class="modal-header">
        <h2>{{ title }}</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      
      <div class="modal-body">
        <!-- Текстовый фильтр -->
        <div v-if="filterType === 'text'" class="text-filter">
          <label>Поиск по тексту:</label>
          <input
            ref="textInput"
            type="text"
            v-model="textFilterValue"
            placeholder="Введите текст для поиска..."
            @keyup.enter="applyTextFilter"
            class="text-input"
          />
          <div class="filter-examples">
            <p><strong>Примеры:</strong></p>
            <ul>
              <li><code>"а"</code> - содержит букву "а"</li>
              <li><code>"ар"</code> - содержит "ар"</li>
              <li>Регистр не учитывается</li>
            </ul>
          </div>
        </div>
        
        <!-- Фильтр с чекбоксами -->
        <div v-if="filterType === 'multiselect'" class="checkbox-filter">
          <div class="filter-controls">
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Поиск в списке..."
              class="search-input"
              @keyup.enter="selectAllFiltered"
            />
            <div class="selection-controls">
              <button @click="selectAll" class="control-btn">Выбрать все</button>
              <button @click="deselectAll" class="control-btn">Снять все</button>
              <button @click="invertSelection" class="control-btn">Инвертировать</button>
            </div>
          </div>
          
          <div class="selection-stats">
            <span>Выбрано: {{ selectedCount }} из {{ filteredOptions.length }}</span>
            <span v-if="searchQuery">Найдено: {{ filteredOptions.length }}</span>
          </div>
          
          <div class="checkbox-list">
            <div 
              v-for="option in filteredOptions" 
              :key="option.value"
              class="checkbox-item"
              @click="toggleOption(option.value)"
            >
              <input
                type="checkbox"
                :id="'option-' + option.value"
                :checked="selectedValues.includes(option.value)"
                @change="toggleOption(option.value)"
                class="checkbox-input"
              />
              <label 
                :for="'option-' + option.value"
                class="checkbox-label"
                :class="{ 'selected': selectedValues.includes(option.value) }"
              >
                {{ option.label }}
                <span class="item-count">({{ option.count }})</span>
              </label>
            </div>
          </div>
          
          <div v-if="filteredOptions.length === 0" class="no-results">
            Ничего не найдено по запросу "{{ searchQuery }}"
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <div class="footer-left">
          <button @click="resetFilter" class="btn-secondary">
            {{ filterType === 'text' ? 'Очистить' : 'Сбросить' }}
          </button>
        </div>
        <div class="footer-right">
          <button @click="$emit('close')" class="btn-cancel">Отмена</button>
          <button @click="applyFilter" class="btn-primary">Применить</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  columnId: {
    type: String,
    required: true
  },
  filterType: {
    type: String,
    default: 'text' // 'text' или 'multiselect'
  },
  // Для текстового фильтра
  currentTextFilter: {
    type: String,
    default: ''
  },
  // Для чекбоксов
  options: {
    type: Array,
    default: () => [] // массив объектов {value, label, count}
  },
  selectedOptions: {
    type: Array,
    default: () => [] // массив выбранных значений
  }
});

const emit = defineEmits(['close', 'apply', 'reset']);

// Текстовый фильтр
const textFilterValue = ref(props.currentTextFilter);
const textInput = ref(null);

// Чекбокс фильтр
const searchQuery = ref('');
const selectedValues = ref([...props.selectedOptions]);

// Вычисляемые свойства для чекбоксов
const filteredOptions = computed(() => {
  if (!searchQuery.value.trim()) {
    return props.options;
  }
  
  const query = searchQuery.value.toLowerCase();
  return props.options.filter(option => 
    option.label.toLowerCase().includes(query) ||
    option.value.toLowerCase().includes(query)
  );
});

const selectedCount = computed(() => selectedValues.value.length);

// Методы
const applyTextFilter = () => {
  emit('apply', { type: 'text', value: textFilterValue.value });
};

const applyFilter = () => {
  if (props.filterType === 'text') {
    applyTextFilter();
  } else {
    emit('apply', { type: 'multiselect', values: [...selectedValues.value] });
  }
};

const resetFilter = () => {
  if (props.filterType === 'text') {
    textFilterValue.value = '';
    emit('reset', { type: 'text' });
  } else {
    selectedValues.value = [];
    emit('reset', { type: 'multiselect' });
  }
};

// Методы для чекбоксов
const toggleOption = (value) => {
  const index = selectedValues.value.indexOf(value);
  if (index === -1) {
    selectedValues.value.push(value);
  } else {
    selectedValues.value.splice(index, 1);
  }
};

const selectAll = () => {
  selectedValues.value = props.options.map(option => option.value);
};

const deselectAll = () => {
  selectedValues.value = [];
};

const invertSelection = () => {
  const allValues = props.options.map(option => option.value);
  selectedValues.value = allValues.filter(value => !selectedValues.value.includes(value));
};

const selectAllFiltered = () => {
  const filteredValues = filteredOptions.value.map(option => option.value);
  selectedValues.value = [...new Set([...selectedValues.value, ...filteredValues])];
};

// Автофокус при открытии
onMounted(() => {
  if (props.filterType === 'text' && textInput.value) {
    textInput.value.focus();
    textInput.value.select();
  }
});

// Следим за изменениями props
watch(() => props.selectedOptions, (newVal) => {
  selectedValues.value = [...newVal];
}, { immediate: true });

watch(() => props.currentTextFilter, (newVal) => {
  textFilterValue.value = newVal;
}, { immediate: true });
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.modal {
  background-color: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease;
  display: flex;
  flex-direction: column;
}

.wide-modal {
  max-width: 600px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  background-color: #f8f9fa;
  flex-shrink: 0;
}

.modal-header h2 {
  margin: 0;
  color: #333;
  font-size: 1.4rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background-color: #e9ecef;
  color: #333;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Текстовый фильтр */
.text-filter {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.text-filter label {
  font-weight: 600;
  color: #333;
  font-size: 15px;
}

.text-input {
  padding: 12px;
  border: 2px solid #dee2e6;
  border-radius: 6px;
  font-size: 16px;
  transition: all 0.2s;
  width: 100%;
  box-sizing: border-box;
}

.text-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
}

.filter-examples {
  padding: 16px;
  background-color: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #6c757d;
}

.filter-examples p {
  margin: 0 0 10px 0;
  color: #495057;
  font-size: 14px;
}

.filter-examples ul {
  margin: 0;
  padding-left: 20px;
  color: #6c757d;
  font-size: 14px;
}

.filter-examples li {
  margin-bottom: 6px;
}

.filter-examples code {
  background-color: #e9ecef;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Courier New', monospace;
  color: #d63384;
}

/* Чекбокс фильтр */
.checkbox-filter {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-input {
  padding: 10px 12px;
  border: 2px solid #dee2e6;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
}

.selection-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.control-btn {
  padding: 6px 12px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.control-btn:hover {
  background-color: #545b62;
  transform: translateY(-1px);
}

.selection-stats {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #6c757d;
  padding: 8px 0;
  border-bottom: 1px solid #e9ecef;
}

.checkbox-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.checkbox-item:hover {
  background-color: #f8f9fa;
}

.checkbox-input {
  margin-right: 12px;
  cursor: pointer;
  width: 18px;
  height: 18px;
}

.checkbox-label {
  flex-grow: 1;
  cursor: pointer;
  font-size: 14px;
  color: #495057;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.checkbox-label.selected {
  color: #007bff;
  font-weight: 600;
}

.item-count {
  font-size: 12px;
  color: #6c757d;
  font-weight: normal;
}

.no-results {
  text-align: center;
  padding: 20px;
  color: #6c757d;
  font-style: italic;
  border: 1px dashed #dee2e6;
  border-radius: 6px;
}

/* Футер модалки */
.modal-footer {
  padding: 20px;
  border-top: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #f8f9fa;
  flex-shrink: 0;
}

.footer-left, .footer-right {
  display: flex;
  gap: 10px;
}

.btn-primary, .btn-secondary, .btn-cancel {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 100px;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover {
  background-color: #0056b3;
  transform: translateY(-1px);
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background-color: #545b62;
  transform: translateY(-1px);
}

.btn-cancel {
  background-color: transparent;
  color: #6c757d;
  border: 1px solid #6c757d;
}

.btn-cancel:hover {
  background-color: #6c757d;
  color: white;
}

/* Анимации */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Скроллбар */
.checkbox-list::-webkit-scrollbar {
  width: 8px;
}

.checkbox-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.checkbox-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.checkbox-list::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Адаптивность */
@media (max-width: 640px) {
  .modal {
    width: 95%;
    margin: 10px;
  }
  
  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 16px;
  }
  
  .selection-controls {
    flex-direction: column;
  }
  
  .control-btn {
    width: 100%;
  }
  
  .modal-footer {
    flex-direction: column;
    gap: 10px;
  }
  
  .footer-left, .footer-right {
    width: 100%;
  }
  
  .btn-primary, .btn-secondary, .btn-cancel {
    flex-grow: 1;
  }
}
</style>