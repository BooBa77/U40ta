<template>
  <div class="dbtools-page">
    <header class="page-header">
      <button @click="$router.back()" class="back-button">← Назад</button>
    </header>

    <main class="page-main">
      <button class="add-manual-button" @click="addObjectManual">
        Добавить объект вручную
      </button>
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const addObjectManual = () => {
  console.log('Добавление объекта вручную')
  // Здесь будет логика добавления
}
</script>

<style scoped>
.dbtools-page {
  min-height: 100vh;
  padding: var(--spacing);
}

.page-header {
  display: flex;
  align-items: center;
  gap: var(--spacing);
  margin-bottom: var(--spacing-lg);
}

.back-button {
  background: var(--color-secondary);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius);
  padding: var(--spacing-sm) var(--spacing);
  cursor: pointer;
  transition: var(--transition);
}

.back-button:hover {
  background: var(--color-primary);
  color: white;
}

.add-manual-button {
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--border-radius-lg);
  padding: var(--spacing-lg);
  font-size: 1.1rem;
  cursor: pointer;
  transition: var(--transition);
  box-shadow: var(--shadow);
}

.add-manual-button:hover {
  background: #0077b3;
  box-shadow: var(--shadow-lg);
}
</style>