<template>
  <div class="statement-page">
    <div class="header">
      <button @click="$router.push('/')">← Назад</button>
      <h1>Ведомость #{{ attachmentId }}</h1>
    </div>
    
    <!-- Загрузка -->
    <div v-if="loading" class="loading">
      Загрузка ведомости...
    </div>
    
    <!-- Ошибка -->
    <div v-else-if="error" class="error">
      {{ error }}
      <button @click="reload">Повторить</button>
    </div>
    
    <!-- Данные -->
    <div v-else class="content">
      <div class="stats">
        <p>Загружено строк: {{ statements.length }}</p>
      </div>
      
      <!-- Таблица -->
      <StatementTable 
        v-if="statements.length > 0"
        :statements="statements"
        :columns="columns"
      />
      
      <div v-else class="empty">
        В ведомости нет данных
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import StatementTable from './components/StatementTable.vue'
import { useStatementData } from './composables/useStatementData'
import { useStatementColumns } from './composables/useStatementColumns'

const route = useRoute()
const attachmentId = route.params.id

// Загружаем данные
const { loading, error, statements, reload } = useStatementData(attachmentId)

// Получаем колонки
const columns = useStatementColumns()
</script>

<style scoped>
@import './StatementPage.css';
</style>