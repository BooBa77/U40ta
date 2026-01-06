<script setup>
import { ref, computed, watch } from 'vue';
import { useVueTable, getCoreRowModel, getFilteredRowModel } from '@tanstack/vue-table';
import { tableConfig } from './filterUtils.js';
import { countriesData } from './countriesData.js';
import { useModal } from './modalUtils.js';
import Modal from './Modal.vue';

// 1. Инициализация данных
const data = ref(countriesData);

// 2. Состояния фильтров - используем простые ref как в старом коде
const countryFilter = ref('а');  // начальное значение
const capitalFilter = ref('');   // пустое значение

// 3. Инициализация модального окна
const {
  isModalOpen,
  modalTitle,
  modalContent,
  modalColumnId,
  modalFilterValue,
  openModal,
  closeModal
} = useModal();

// 4. Настройка столбцов
const columns = ref(tableConfig.getColumns().map(col => ({
  ...col,
  headerClickHandler: () => {
    // Получаем текущее значение фильтра для этой колонки
    let currentFilter = '';
    if (col.accessorKey === 'country') {
      currentFilter = countryFilter.value;
    } else if (col.accessorKey === 'capital') {
      currentFilter = capitalFilter.value;
    }
    
    openModal(
      col.header,
      `Фильтрация по колонке "${col.header}". Введите текст для поиска.`,
      col.accessorKey,
      currentFilter
    );
  }
})));

// 5. Инициализация таблицы
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

// 6. Функция обновления фильтров в таблице
const updateTableFilters = () => {
  const filters = [];
  
  // Добавляем фильтр для страны если есть значение
  if (countryFilter.value && countryFilter.value.trim() !== '') {
    filters.push({ 
      id: 'country', 
      value: countryFilter.value 
    });
  }
  
  // Добавляем фильтр для столицы если есть значение
  if (capitalFilter.value && capitalFilter.value.trim() !== '') {
    filters.push({ 
      id: 'capital', 
      value: capitalFilter.value 
    });
  }
  
  // Применяем фильтры - ПРОСТО КАК В СТАРОМ КОДЕ
  table.setColumnFilters(filters);
};

// 7. Инициализация фильтра при старте
updateTableFilters();

// 8. Обработчики из модалки
const handleModalApply = (value) => {
  if (modalColumnId.value === 'country') {
    countryFilter.value = value;
  } else if (modalColumnId.value === 'capital') {
    capitalFilter.value = value;
  }
  
  // Обновляем фильтры в таблице
  updateTableFilters();
  closeModal();
};

const handleModalReset = () => {
  if (modalColumnId.value === 'country') {
    countryFilter.value = '';
  } else if (modalColumnId.value === 'capital') {
    capitalFilter.value = '';
  }
  
  // Обновляем фильтры в таблице
  updateTableFilters();
  closeModal();
};

// 9. Сброс всех фильтров
const clearAllFilters = () => {
  countryFilter.value = '';
  capitalFilter.value = '';
  updateTableFilters();
};

// 10. Computed свойства
const visibleRows = computed(() => table.getRowModel().rows);
const resultsCount = computed(() => visibleRows.value.length);

// 11. Watch для отладки (можно удалить после тестирования)
watch([countryFilter, capitalFilter], () => {
  console.log('Фильтры изменены:', {
    country: countryFilter.value,
    capital: capitalFilter.value
  });
}, { immediate: true });
</script>

<template>
  <div>
    <h1>Таблица Страна-Столица с фильтрами</h1>
    
    <!-- Отладочная информация -->
    <div style="margin: 15px 0; padding: 10px; background: #f0f0f0; border-radius: 4px;">
      <div><strong>Текущие фильтры:</strong></div>
      <div>Страна: "{{ countryFilter }}"</div>
      <div>Столица: "{{ capitalFilter }}"</div>
      <div>Найдено записей: {{ resultsCount }}</div>
      <button @click="clearAllFilters" style="margin-top: 10px;">
        Сбросить все фильтры
      </button>
    </div>
    
    <!-- Таблица -->
    <table>
      <thead>
        <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
          <th 
            v-for="header in headerGroup.headers" 
            :key="header.id"
            @click="header.column.columnDef.headerClickHandler?.()"
            :style="{ 
              cursor: 'pointer',
              backgroundColor: (header.column.id === 'country' && countryFilter) || 
                              (header.column.id === 'capital' && capitalFilter) ? '#e3f2fd' : '#f4f4f4'
            }"
          >
            {{ header.column.columnDef.header }}
            <span 
              v-if="(header.column.id === 'country' && countryFilter) || 
                    (header.column.id === 'capital' && capitalFilter)"
              style="color: #007bff; margin-left: 5px;"
            >
              ⚡
            </span>
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
    <div v-if="visibleRows.length === 0" style="margin-top: 20px; padding: 20px; background-color: #ffe6e6; border: 1px solid #ff9999;">
      <strong>Нет данных, соответствующих фильтру.</strong>
      <div style="margin-top: 10px;">
        <button @click="clearAllFilters">Сбросить фильтры</button>
      </div>
    </div>
    
    <div v-else style="margin-top: 20px; color: #666;">
      Найдено стран: {{ resultsCount }}
    </div>

    <!-- Модальное окно фильтрации -->
    <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2>Фильтр: {{ modalTitle }}</h2>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <p>Введите текст для фильтрации:</p>
          <input
            type="text"
            v-model="modalFilterValue"
            placeholder="Например: а, ар, бер..."
            style="width: 100%; padding: 10px; margin: 10px 0;"
            @keyup.enter="handleModalApply(modalFilterValue)"
            autofocus
          />
        </div>
        <div class="modal-footer">
          <button @click="handleModalReset" style="background-color: #6c757d;">
            Сбросить
          </button>
          <button @click="handleModalApply(modalFilterValue)" style="background-color: #007bff;">
            Применить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}

th, td {
  border: 1px solid #ccc;
  padding: 12px;
  text-align: left;
}

th {
  background-color: #f4f4f4;
  user-select: none;
}

button {
  padding: 8px 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

button:hover {
  background-color: #0056b3;
}

/* Стили модального окна */
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
}

.modal {
  background-color: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h2 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.close-btn:hover {
  background-color: #f0f0f0;
  color: #333;
}

.modal-body {
  padding: 20px;
  color: #555;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>