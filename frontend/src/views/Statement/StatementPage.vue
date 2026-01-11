<script setup>
import { ref, computed, watch } from 'vue';
import { useVueTable, getCoreRowModel, getFilteredRowModel } from '@tanstack/vue-table';
import { tableConfig } from './filterUtils.js';
import { countriesData } from './countriesData.js';
import FilterModal from './FilterModal.vue';

// 1. Инициализация данных
const data = ref(countriesData);

// 2. Состояния фильтров
const filters = ref({
  country: { type: 'text', value: 'а' },
  capital: { type: 'text', value: '' },
  continent: { type: 'multiselect', values: [] }
});

// 3. Состояние модалки
const isModalOpen = ref(false);
const modalConfig = ref({
  title: '',
  columnId: '',
  filterType: 'text',
  currentTextFilter: '',
  options: [],
  selectedOptions: []
});

// 4. Получение уникальных значений для чекбоксов
const getOptionsForColumn = (columnId) => {
  // Используем tableConfig.getColumnUniqueValues вместо getUniqueValues
  const uniqueValues = tableConfig.getColumnUniqueValues(data.value, columnId);
  return uniqueValues.map(value => {
    const count = data.value.filter(item => item[columnId] === value).length;
    return {
      value,
      label: value,
      count
    };
  });
};

// 5. Открытие модалки для фильтра
const openFilterModal = (column) => {
  const columnId = column.accessorKey;
  const filter = filters.value[columnId];
  
  modalConfig.value = {
    title: `Фильтр: ${column.header}`,
    columnId,
    filterType: column.filterType || 'text',
    currentTextFilter: filter.type === 'text' ? filter.value : '',
    options: column.filterType === 'multiselect' ? getOptionsForColumn(columnId) : [],
    selectedOptions: filter.type === 'multiselect' ? [...filter.values] : []
  };
  
  isModalOpen.value = true;
};

// 6. Закрытие модалки
const closeModal = () => {
  isModalOpen.value = false;
};

// 7. Применение фильтра из модалки
const applyFilterFromModal = (filterData) => {
  const { columnId } = modalConfig.value;
  
  if (filterData.type === 'text') {
    filters.value[columnId] = { 
      type: 'text', 
      value: filterData.value 
    };
  } else if (filterData.type === 'multiselect') {
    filters.value[columnId] = { 
      type: 'multiselect', 
      values: [...filterData.values] 
    };
  }
  
  closeModal();
  updateTableFilters();
};

// 8. Сброс фильтра
const resetFilterFromModal = (filterData) => {
  const { columnId } = modalConfig.value;
  
  if (filterData.type === 'text') {
    filters.value[columnId] = { type: 'text', value: '' };
  } else if (filterData.type === 'multiselect') {
    filters.value[columnId] = { type: 'multiselect', values: [] };
  }
  
  closeModal();
  updateTableFilters();
};

// 9. Настройка столбцов
const columns = ref(tableConfig.getColumns().map(col => ({
  ...col,
  headerClickHandler: () => openFilterModal(col)
})));

// 10. Инициализация таблицы
const table = useVueTable({
  data: data.value,
  columns: columns.value,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  initialState: {
    columnFilters: []
  },
  filterFns: tableConfig.filterFns,
});

// 11. Обновление фильтров в таблице
const updateTableFilters = () => {
  const columnFilters = [];
  
  Object.entries(filters.value).forEach(([columnId, filter]) => {
    if (filter.type === 'text' && filter.value && filter.value.trim() !== '') {
      columnFilters.push({
        id: columnId,
        value: filter.value
      });
    } else if (filter.type === 'multiselect' && filter.values && filter.values.length > 0) {
      columnFilters.push({
        id: columnId,
        value: filter.values
      });
    }
  });
  
  table.setColumnFilters(columnFilters);
};

// 12. Инициализация фильтров
updateTableFilters();

// 13. Сброс всех фильтров
const clearAllFilters = () => {
  Object.keys(filters.value).forEach(columnId => {
    if (filters.value[columnId].type === 'text') {
      filters.value[columnId].value = '';
    } else if (filters.value[columnId].type === 'multiselect') {
      filters.value[columnId].values = [];
    }
  });
  
  updateTableFilters();
};

// 14. Вычисляемые свойства
const visibleRows = computed(() => table.getRowModel().rows);
const resultsCount = computed(() => visibleRows.value.length);

const activeFilters = computed(() => {
  const active = [];
  
  Object.entries(filters.value).forEach(([columnId, filter]) => {
    const column = columns.value.find(c => c.accessorKey === columnId);
    if (!column) return;
    
    if (filter.type === 'text' && filter.value) {
      active.push({
        column: column.header,
        value: filter.value,
        type: 'text'
      });
    } else if (filter.type === 'multiselect' && filter.values.length > 0) {
      active.push({
        column: column.header,
        values: filter.values,
        count: filter.values.length,
        type: 'multiselect'
      });
    }
  });
  
  return active;
});

const hasActiveFilters = computed(() => activeFilters.value.length > 0);

const filterSummary = computed(() => {
  if (!hasActiveFilters.value) return 'Нет активных фильтров';
  
  return activeFilters.value.map(filter => {
    if (filter.type === 'text') {
      return `${filter.column}: "${filter.value}"`;
    } else {
      return `${filter.column}: ${filter.values.length} выбрано`;
    }
  }).join('; ');
});

// 15. Watch для отладки
watch(filters, () => {
  console.log('Фильтры обновлены:', filters.value);
}, { deep: true, immediate: true });
</script>

<template>
  <div>
    <h1>Таблица стран с фильтрами как в Excel</h1>
    
    <!-- Панель фильтров -->
    <div class="filters-panel">
      <div class="active-filters">
        <strong>Активные фильтры:</strong> {{ filterSummary }}
        <span v-if="hasActiveFilters" class="clear-all" @click="clearAllFilters">
          (сбросить все)
        </span>
      </div>
      <div class="filter-hint">
        Кликните на заголовок колонки для настройки фильтра. Доступны текстовый поиск и выбор из списка.
      </div>
    </div>
    
    <!-- Отладочная информация -->
    <div class="debug-panel" v-if="false">
      <h3>Отладочная информация:</h3>
      <pre>{{ filters }}</pre>
      <div>Найдено записей: {{ resultsCount }} из {{ data.length }}</div>
    </div>
    
    <!-- Таблица -->
    <table>
      <thead>
        <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
          <th 
            v-for="header in headerGroup.headers" 
            :key="header.id"
            @click="header.column.columnDef.headerClickHandler?.()"
            :class="{ 
              'clickable-header': true,
              'has-filter': activeFilters.find(f => 
                f.column === header.column.columnDef.header
              ),
              'text-filter': header.column.columnDef.filterType === 'text',
              'multiselect-filter': header.column.columnDef.filterType === 'multiselect'
            }"
          >
            <div class="header-content">
              <span>{{ header.column.columnDef.header }}</span>
              <span class="header-icons">
                <span 
                  v-if="activeFilters.find(f => f.column === header.column.columnDef.header)"
                  class="filter-indicator"
                  :title="activeFilters.find(f => f.column === header.column.columnDef.header)?.type === 'multiselect' 
                    ? `${activeFilters.find(f => f.column === header.column.columnDef.header)?.count} выбрано`
                    : 'Активный фильтр'"
                >
                  {{ header.column.columnDef.filterType === 'multiselect' ? '✓' : '⚡' }}
                </span>
                <span class="info-icon">▼</span>
              </span>
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in visibleRows" :key="row.id">
          <td v-for="cell in row.getVisibleCells()" :key="cell.id">
            {{ cell.getValue() }}
          </td>
        </tr>
      </tbody>
    </table>
    
    <!-- Сообщение при отсутствии результатов -->
    <div v-if="visibleRows.length === 0" class="no-results">
      <strong>Нет данных, соответствующих фильтрам.</strong>
      <div class="no-results-actions">
        <button @click="clearAllFilters">
          Сбросить все фильтры
        </button>
        <div class="debug-info">
          Данные: {{ data.length }} записей доступно<br>
          Активных фильтров: {{ activeFilters.length }}
        </div>
      </div>
    </div>
    
    <!-- Статистика -->
    <div class="results-info">
      <div class="results-stats">
        <span>Найдено записей: {{ resultsCount }}</span>
        <span class="separator">•</span>
        <span>Всего записей: {{ data.length }}</span>
        <span class="separator">•</span>
        <span>Активных фильтров: {{ activeFilters.length }}</span>
      </div>
    </div>

    <!-- Модальное окно фильтрации -->
    <FilterModal
      v-if="isModalOpen"
      :title="modalConfig.title"
      :columnId="modalConfig.columnId"
      :filterType="modalConfig.filterType"
      :currentTextFilter="modalConfig.currentTextFilter"
      :options="modalConfig.options"
      :selectedOptions="modalConfig.selectedOptions"
      @close="closeModal"
      @apply="applyFilterFromModal"
      @reset="resetFilterFromModal"
    />
  </div>
</template>

<style scoped>
/* Основные стили таблицы */
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

th, td {
  border: 1px solid #e9ecef;
  padding: 14px;
  text-align: left;
}

th {
  background-color: #f8f9fa;
  user-select: none;
  font-weight: 600;
  color: #495057;
  transition: all 0.2s;
}

.clickable-header {
  cursor: pointer;
  position: relative;
}

.clickable-header:hover {
  background-color: #e9ecef;
}

.has-filter {
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  border-left: 4px solid #007bff;
}

.text-filter.has-filter {
  border-left-color: #28a745;
}

.multiselect-filter.has-filter {
  border-left-color: #fd7e14;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-icons {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
}

.filter-indicator {
  color: #007bff;
  font-weight: bold;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.info-icon {
  color: #6c757d;
  font-size: 10px;
}

/* Панель фильтров */
.filters-panel {
  margin: 20px 0;
  padding: 15px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 8px;
  border-left: 4px solid #28a745;
}

.active-filters {
  margin-bottom: 10px;
  padding: 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #dee2e6;
  font-size: 14px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.clear-all {
  color: #dc3545;
  cursor: pointer;
  text-decoration: underline;
  font-weight: 600;
  white-space: nowrap;
}

.clear-all:hover {
  color: #c82333;
  text-decoration: none;
}

.filter-hint {
  color: #6c757d;
  font-size: 14px;
  font-style: italic;
}

/* Сообщение об отсутствии результатов */
.no-results {
  margin-top: 30px;
  padding: 25px;
  background: linear-gradient(135deg, #fff5f5 0%, #ffe3e3 100%);
  border: 2px solid #fa5252;
  border-radius: 8px;
  text-align: center;
}

.no-results-actions {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.debug-info {
  padding: 15px;
  background: white;
  border-radius: 6px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  border: 1px solid #dee2e6;
  text-align: left;
  width: 100%;
  max-width: 400px;
}

/* Статистика результатов */
.results-info {
  margin-top: 20px;
  padding: 15px;
  background: linear-gradient(135deg, #e7f5ff 0%, #d0ebff 100%);
  border-radius: 8px;
  border: 1px solid #339af0;
}

.results-stats {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  font-weight: 600;
  color: #1971c2;
  flex-wrap: wrap;
}

.separator {
  color: #74c0fc;
}

/* Кнопки */
button {
  padding: 10px 20px;
  background: linear-gradient(135deg, #339af0 0%, #228be6 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  min-width: 160px;
}

button:hover {
  background: linear-gradient(135deg, #228be6 0%, #1971c2 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 123, 255, 0.3);
}

button:active {
  transform: translateY(0);
}

/* Отладочная панель */
.debug-panel {
  margin: 15px 0;
  padding: 15px;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-family: monospace;
  font-size: 12px;
  overflow: auto;
  max-height: 200px;
}

/* Адаптивность */
@media (max-width: 768px) {
  table {
    font-size: 14px;
  }
  
  th, td {
    padding: 10px;
  }
  
  .results-stats {
    flex-direction: column;
    gap: 10px;
  }
  
  .separator {
    display: none;
  }
  
  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
  
  .header-icons {
    align-self: flex-end;
  }
  
  .active-filters {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
}
</style>