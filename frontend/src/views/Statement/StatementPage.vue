<template>
  <div class="statement-page">
    <header class="page-header">
      <button @click="goBack" class="back-btn">← Назад</button>
      <h1>Ведомость #{{ id }}</h1>
      <div class="page-subtitle">Обычная ведомость (ОСВ/ОС)</div>
    </header>

    <main class="page-content">
      <div class="info-card">
        <h2>Hello World! 👋</h2>
        <p>Это страница обработки обычной ведомости.</p>
        <p>ID ведомости: <strong>{{ id }}</strong></p>
        <p>Здесь будет интерфейс для работы с ведомостью.</p>
      </div>

      <div class="actions">
        <button @click="simulateAction" class="action-btn">
          Тестовая кнопка
        </button>
      </div>
    </main>

    <footer class="page-footer">
      <small>StatementsModule в разработке</small>
    </footer>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const id = route.params.id

const goBack = () => {
  router.push('/')
}

const simulateAction = () => {
  alert(`Действие для ведомости ${id}`)
}
</script>

<style scoped>
.statement-page {
  min-height: 100vh;
  padding: 20px;
  background: #f5f5f5;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 30px;
  padding-bottom: 15px;
  border-bottom: 2px solid #ddd;
}

.back-btn {
  padding: 8px 16px;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
}

.back-btn:hover {
  background: #f0f0f0;
}

.page-subtitle {
  color: #666;
  font-style: italic;
}

.info-card {
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.actions {
  display: flex;
  gap: 10px;
}

.action-btn {
  padding: 10px 20px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.action-btn:hover {
  background: #45a049;
}

.page-footer {
  margin-top: 40px;
  text-align: center;
  color: #888;
}
</style>