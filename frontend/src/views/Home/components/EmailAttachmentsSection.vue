<template>
  <section class="email-attachments-section">
    <!-- Таблица файлов -->
    <div class="attachments-grid">
      <!-- Состояние "нет файлов" -->
      <div class="empty-state" v-if="!files.length && !isLoading">
        Файлов нет
      </div>
      
      <!-- Состояние загрузки -->
      <div class="empty-state" v-if="isLoading">
        Загрузка...
      </div>

      <!-- Строки файлов -->
      <template v-if="files.length > 0">
        <div class="grid-row" v-for="file in files" :key="file.id">
          <!-- Колонка 1: Кнопка "Взять в работу" -->
          <div class="grid-cell actions">
            <button class="action-btn" title="Взять в работу">
              <img src="/images/email-file_check.png" alt="Взять в работу">
            </button>
          </div>
          
          <!-- Колонка 2: Контент (3 строки) -->
          <div class="grid-cell content">
            <div class="date">{{ formatDate(file.received_at) }}</div>
            <div class="doc-info">{{ file.doc_type }} {{ file.sklad }}</div>
            <div class="sender">{{ file.email_from }}</div>
          </div>
          
          <!-- Колонка 3: Кнопка "Удалить файл" -->
          <div class="grid-cell actions">
            <button class="action-btn" title="Удалить">
              <img src="/images/email-file_delete.png" alt="Удалить">
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Кнопка проверки почты -->
    <div class="email-check-footer">
      <button class="check-email-btn" @click="checkEmail" :disabled="isLoadingCheck">
        <img v-if="!isLoadingCheck" src="/images/email_check.png" alt="Проверить почту">
        <span v-else>Загрузка...</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// Состояния
const isLoading = ref(true)
const isLoadingCheck = ref(false)
const files = ref([])

// Загрузка файлов с API
const loadFiles = async () => {
  isLoading.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch('/api/email/attachments', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (response.ok) {
      files.value = await response.json()
    }
  } catch (error) {
    console.error('Ошибка загрузки файлов:', error)
  } finally {
    isLoading.value = false
  }
}

// Форматирование даты
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU')
}

// Проверка почты
const checkEmail = async () => {
  isLoadingCheck.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch('/api/email/check-now', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const result = await response.json()
    console.log('Результат проверки:', result)
    
    if (result.success) {
      await loadFiles()
    }
  } catch (error) {
    console.error('Ошибка проверки почты:', error)
  } finally {
    isLoadingCheck.value = false
  }
}

// При монтировании загружаем файлы
onMounted(() => {
  loadFiles()
})
</script>

<style scoped>
/* Все стили перенесены в отдельный CSS-файл */
@import './EmailAttachmentsSection.css';
</style>