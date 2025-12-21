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


            <button class="action-btn" 
              title="Открыть ведомость"
              @click="openStatement(file.id, file.is_inventory, file.in_process)">
              <img 
                :src="file.in_process 
                  ? '/images/open_processing_file.png' 
                  : '/images/email-file_to_db.png'" 
                alt="Открыть ведомость"
              />
            </button>



          </div>
          
          <!-- Колонка 2: Контент (3 строки) -->
          <div class="grid-cell content">
            <div class="date">{{ formatDate(file.received_at) }}</div>
            <div class="doc-info">{{ file.is_inventory ? `Инвентаризация ${file.doc_type}` : file.doc_type + ' ' }}{{ file.sklad }}</div>
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
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router'

// Состояния
const isLoading = ref(true)
const isLoadingCheck = ref(false)
const files = ref([])
const eventSource = ref(null) // SSE
const router = useRouter()

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
// Функция для подключения к SSE
const connectToSSE = () => {
  console.log('connectToSSE() вызвана');
  
  // Закрываем предыдущее соединение, если есть
  if (eventSource.value) {
    console.log('Закрываем предыдущее SSE соединение');
    eventSource.value.close();
  }

  // Обработка SSE. Создаём новое соединение
  const sseUrl = '/api/app-events/sse';
  console.log('Подключаемся к SSE:', sseUrl);
  
  eventSource.value = new EventSource(sseUrl);
  
  // Событие открытия соединения
  eventSource.value.addEventListener('open', () => {
    console.log('SSE соединение установлено');
  });
  
  // Обработчик входящих сообщений
  eventSource.value.addEventListener('message', (event) => {
    console.log('Получено сырое SSE-событие:', event.data);
    
    try {
      const data = JSON.parse(event.data);
      console.log('Распарсено SSE-событие:', data);
      
      if (data.message === 'email-attachments-updated') {
        console.log('получено SSE на обновление списка файлов');
        loadFiles(); // Перезагружаем список файлов
      }
    } catch (error) {
      console.error('Ошибка парсинга SSE-события:', error, 'Сырые данные:', event.data);
    }
  });
  
  // Обработчик ошибок
  eventSource.value.addEventListener('error', (error) => {
    console.error('SSE ошибка соединения:', error);
    console.log('EventSource автоматически переподключится');
  });
  
  // Выводим объект для отладки
  console.log('EventSource объект создан:', eventSource.value);
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
      // await loadFiles()  обновление таблицы произойдёт по SSE событию
    }
  } catch (error) {
    console.error('Ошибка проверки почты:', error)
  } finally {
    isLoadingCheck.value = false
  }
}

// Переход на ведомость:
const openStatement = async (attachmentId, isInventory, inProcess) => {
  if (isInventory) {
    // Модуль Инвентаризация ещё не разработан
    router.push(`/inventory/${attachmentId}`);
    return;
  }
  // Обычная ведомость - открываем StatementsModule
  router.push(`/statement/${attachmentId}`);
}

// При монтировании загружаем файлы
onMounted(() => {
  loadFiles()
  connectToSSE() // Подключаемся к SSE
  console.log('EmailAttachmentsSection смонтирован');    
})

// Закрываем соединение при размонтировании
onUnmounted(() => {
  if (eventSource.value) {
    eventSource.value.close()
    console.log('SSE соединение закрыто')
  }
})
</script>

<style scoped>
/* Все стили перенесены в отдельный CSS-файл */
@import './EmailAttachmentsSection.css';
</style>