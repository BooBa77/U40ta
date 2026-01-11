<!-- src/views/Statement/components/StatementTable.vue -->
<template>
  <div class="statement-table-container">
    <!-- Заголовок ведомости -->
    <div class="statement-header">
      <h2>Ведомость #{{ attachmentId }}</h2>
      <div class="statement-info">
        <div>Завод: {{ zavod }}</div>
        <div>Склад: {{ sklad }}</div>
        <div>Тип: {{ doc_type }}</div>
      </div>
    </div>

    <!-- Таблица -->
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.id" :style="{ width: col.size + 'px' }">
              {{ col.header }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="row in tableData" 
            :key="row.id"
            :class="getRowClass(row)"
            @click="handleRowClick(row)"
          >
            <td v-for="col in columns" :key="col.id" :style="{ width: col.size + 'px' }">
              {{ col.cell ? col.cell({ row: { original: row } }) : row[col.accessorKey] }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useStatementData } from '../composables/useStatementData';
import { useStatementColumns } from '../composables/useStatementColumns';

const props = defineProps({
  statements: {
    type: Array,
    required: true
  },
  attachmentId: String,
  zavod: Number,
  sklad: String,
  doc_type: String
});

// Обработка данных
const { sortedData, getRowColor } = useStatementData(props.statements);
const { columns } = useStatementColumns();

const tableData = computed(() => sortedData.value);

const getRowClass = (row) => {
  const color = getRowColor(row);
  return `row-${color}`;
};

const handleRowClick = (row) => {
  console.log('Открыть модалку для:', row);
};
</script>

<style scoped>
.statement-table-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.statement-header {
  padding: 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  flex-shrink: 0;
}

.statement-info {
  display: flex;
  gap: 20px;
  margin-top: 8px;
}

.table-wrapper {
  flex: 1;
  overflow: auto;
  position: relative;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 600px;
}

thead {
  position: sticky;
  top: 0;
  background: white;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

th, td {
  border: 1px solid #dee2e6;
  padding: 12px;
  text-align: left;
  vertical-align: middle;
}

/* Цвета строк */
.row-red {
  background-color: #ffe6e6;
}
.row-yellow {
  background-color: #fff3cd;
}
.row-green {
  background-color: #d4edda;
}
.row-gray {
  background-color: #e9ecef;
  color: #6c757d;
}

/* Кнопка QR */
.qr-button {
  padding: 6px 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.qr-button:hover {
  background: #0056b3;
}
</style>