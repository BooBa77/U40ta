<template>
  <section class="email-attachments-section">
    <!-- Таблица файлов -->
    <div class="attachments-grid">
      <!-- Заголовки -->
      <div> </div>
      <div class="grid-header date">Дата</div>
      <div class="grid-header description">Описание</div>
      <div class="grid-header sender">Отправитель</div>
      <div class="grid-header actions">Действия</div>

      <!-- Состояние "нет файлов" -->
      <div class="empty-state" v-if="!files.length">
        Файлов нет
      </div>

      <!-- Тестовые данные (пока статика) -->
      <div class="grid-cell status">
        <img src="/images/email-file_bad.png" alt="Статус" class="status-icon">
      </div>
      <div class="grid-cell date">29.11.2025</div>
      <div class="grid-cell description">Инвентаризация s017</div>
      <div class="grid-cell sender">ivanov@site.com</div>
      <div class="grid-cell actions">
        <button class="action-btn">
          <img src="/images/email-file_check.png" alt="Взять в работу">
        </button>
        <button class="action-btn">
          <img src="/images/email-file_delete.png" alt="Удалить">
        </button>
      </div>
    </div>

    <!-- Уведомление о результате проверки -->
    <div v-if="checkResult" class="result-message" :class="checkResult.success ? 'success' : 'error'">
      {{ checkResult.message }}
    </div>

    <!-- Кнопка проверки почты -->
    <div class="email-check-footer">
      <button 
        class="check-email-btn" 
        @click="checkEmail"
        :disabled="isLoading"
      >
        <!-- Показываем лоадер или иконку -->
        <img v-if="!isLoading" src="/images/email_check.png" alt="Проверить почту">
        <span v-else>Загрузка...</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'

// Состояние загрузки - показываем лоадер при запросе
const isLoading = ref(false)

// Результат последней проверки почты (успех/ошибка)
const checkResult = ref(null)

// Список файлов (пока пустой, позже заменим на реальные данные из БД)
const files = ref([])

// Основная функция проверки почты
const checkEmail = async () => {
  // Сбрасываем предыдущий результат и включаем лоадер
  isLoading.value = true
  checkResult.value = null
  
  try {
    // Получаем JWT токен из localStorage
    const token = localStorage.getItem('auth_token')
    if (!token) {
      throw new Error('Токен авторизации не найден')
    }

    // Отправляем POST запрос на ручную проверку почты
    const response = await fetch('/api/email/check-now', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    // Парсим ответ от сервера
    const result = await response.json()
    checkResult.value = result
    
    if (result.success) {
      console.log('✅ Проверка почты завершена успешно')
      // TODO: здесь позже добавим обновление списка файлов
    } else {
      console.error('❌ Ошибка при проверке почты:', result.message)
    }
  } catch (error) {
    // Обрабатываем ошибки сети или парсинга
    console.error('❌ Ошибка сети:', error)
    checkResult.value = { 
      success: false, 
      message: 'Ошибка сети: ' + error.message 
    }
  } finally {
    // Выключаем лоадер в любом случае
    isLoading.value = false
  }
}
</script>

<style scoped>
/* Импорт стилей из отдельного файла */
@import './EmailAttachmentsSection.css';
</style>