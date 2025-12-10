<template>
  <div class="inventory-page">
    <header class="page-header">
      <button @click="goBack" class="back-btn">← Назад</button>
      <h1>Инвентаризация #{{ id }}</h1>
      <div class="page-subtitle">Модуль инвентаризации</div>
    </header>

    <main class="page-content">
      <div class="info-card">
        <h2>📋 Инвентаризация</h2>
        <p>Это страница обработки инвентаризации.</p>
        <p>ID инвентаризации: <strong>{{ id }}</strong></p>
        <p>Модуль находится в разработке.</p>
        
        <div class="features">
          <h3>Планируемый функционал:</h3>
          <ul>
            <li>Сравнение с предыдущими периодами</li>
            <li>Выявление расхождений</li>
            <li>Формирование актов инвентаризации</li>
            <li>Работа ревизоров</li>
          </ul>
        </div>
      </div>
    </main>

    <footer class="page-footer">
      <small>InventoryModule в разработке</small>
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
</script>

<style scoped>
.inventory-page {
  min-height: 100vh;
  padding: 20px;
  background: #f0f8ff;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 30px;
  padding-bottom: 15px;
  border-bottom: 2px solid #b3d9ff;
}

.back-btn {
  padding: 8px 16px;
  background: #fff;
  border: 1px solid #99ccff;
  border-radius: 4px;
  cursor: pointer;
  color: #0066cc;
}

.back-btn:hover {
  background: #e6f2ff;
}

.page-subtitle {
  color: #0066cc;
  font-style: italic;
}

.info-card {
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,102,204,0.1);
  border-left: 5px solid #0066cc;
}

.features {
  margin-top: 20px;
  padding: 15px;
  background: #f0f8ff;
  border-radius: 5px;
}

.features h3 {
  color: #0066cc;
  margin-top: 0;
}

.features ul {
  padding-left: 20px;
}

.features li {
  margin: 5px 0;
  color: #333;
}

.page-footer {
  margin-top: 40px;
  text-align: center;
  color: #6699cc;
}
</style>