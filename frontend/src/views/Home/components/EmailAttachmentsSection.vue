<template>
  <section class="email-attachments-section">
    <!-- Кнопка "Проверить почту" перед таблицей -->
    <!-- Скрывается в оффлайн режиме -->
    <div class="get-email-button-container" v-if="!isFlightMode">
      <button 
        class="get-email-button" 
        @click="checkEmail" 
        :disabled="isLoadingCheck"
      >
        <span v-if="!isLoadingCheck">Проверить почту</span>
        <span v-else>Загрузка...</span>
      </button>
    </div>

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
            <!-- Кнопка удаления скрыта в режиме полёта и если файл в обработке -->
            <button 
              class="action-btn" 
              title="Удалить"
              @click="deleteAttachment(file.id)"
              :disabled="isFlightMode"
              v-if="!isFlightMode">
              <img src="/images/email-file_delete.png" alt="Удалить">
            </button>
            <!-- Пустой блок для сохранения сетки, если кнопка скрыта -->
            <div v-else style="width: 26px; height: 26px;"></div>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router'

// Константа для ключа Flight Mode в localStorage
const FLIGHT_MODE_KEY = 'u40ta_flight_mode';

// Состояния компонента
const isLoading = ref(true);
const isLoadingCheck = ref(false);
const files = ref([]);
const eventSource = ref(null); // Для SSE соединения
const router = useRouter();
const isFlightMode = ref(false); // Состояние Flight Mode

// Загрузка файлов с API
const loadFiles = async () => {
  isLoading.value = true;
  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch('/api/email/attachments', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      files.value = await response.json();
    }
  } catch (error) {
    console.error('Ошибка загрузки файлов:', error);
  } finally {
    isLoading.value = false;
  }
};

// Функция для подключения к SSE (для обновлений ведомостей)
const connectToSSE = () => {
  console.log('EmailAttachmentsSection: подключение к SSE для обновлений ведомостей');
  
  // Закрываем предыдущее соединение, если есть
  if (eventSource.value) {
    console.log('EmailAttachmentsSection: закрываем предыдущее SSE соединение');
    eventSource.value.close();
  }

  // Создаём новое SSE соединение
  const sseUrl = '/api/app-events/sse';
  console.log('EmailAttachmentsSection: подключаемся к SSE:', sseUrl);
  
  eventSource.value = new EventSource(sseUrl);
  
  // Событие открытия соединения
  eventSource.value.addEventListener('open', () => {
    console.log('EmailAttachmentsSection: SSE соединение установлено');
  });
  
  // Обработчик входящих сообщений
  eventSource.value.addEventListener('message', (event) => {
    console.log('EmailAttachmentsSection: получено сырое SSE-событие:', event.data);
    
    try {
      const data = JSON.parse(event.data);
      console.log('EmailAttachmentsSection: распарсено SSE-событие:', data);
      
      // Обрабатываем только события, связанные с ведомостями
      if (data.type === 'statement-updated' || 
          data.type === 'statement-deleted' ||
          data.type === 'statement-active-changed') {
        console.log('EmailAttachmentsSection: обновление списка ведомостей');
        loadFiles();
      }
    } catch (error) {
      console.error('EmailAttachmentsSection: ошибка парсинга SSE-события:', error, 'Сырые данные:', event.data);
    }
  });
  
  // Обработчик ошибок соединения
  eventSource.value.addEventListener('error', (error) => {
    console.error('EmailAttachmentsSection: SSE ошибка соединения:', error);
    console.log('EmailAttachmentsSection: EventSource автоматически переподключится');
  });
  
  console.log('EmailAttachmentsSection: EventSource объект создан');
};

// Форматирование даты для отображения
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU');
};

// Проверка почты (ручная) - недоступна в оффлайн режиме
const checkEmail = async () => {
  // В режиме полёта проверка почты недоступна
  if (isFlightMode.value) return;
  
  isLoadingCheck.value = true;
  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch('/api/email/check-now', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    console.log('EmailAttachmentsSection: результат проверки почты:', result);
    
    // Обновление списка файлов произойдёт по SSE событию от сервера
  } catch (error) {
    console.error('EmailAttachmentsSection: ошибка проверки почты:', error);
  } finally {
    isLoadingCheck.value = false;
  }
};

// Удаление вложения - недоступно в оффлайн режиме
const deleteAttachment = async (attachmentId) => {
  // Подтверждение удаления
  if (!confirm('Удалить это вложение?')) return;
  
  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`/api/email/attachments/${attachmentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Локально удаляем файл из массива
      files.value = files.value.filter(f => f.id !== attachmentId);
      console.log('EmailAttachmentsSection: вложение удалено локально');
    } else {
      console.error('EmailAttachmentsSection: ошибка удаления:', result.message);
    }
  } catch (error) {
    console.error('EmailAttachmentsSection: ошибка при удалении вложения:', error);
  }
};

// Переход на страницу ведомости
const openStatement = async (attachmentId, isInventory, inProcess) => {
  if (isInventory) {
    // Модуль Инвентаризация
    router.push(`/inventory/${attachmentId}`);
    return;
  }
  // Обычная ведомость
  router.push(`/statement/${attachmentId}`);
};

// Обработчик изменения состояния Flight Mode
const handleFlightModeChange = (event) => {
  isFlightMode.value = event.detail.isFlightMode;
  console.log('EmailAttachmentsSection: Flight Mode изменён:', isFlightMode.value);
};

// Инициализация состояния Flight Mode из localStorage
const initFlightMode = () => {
  const saved = localStorage.getItem(FLIGHT_MODE_KEY);
  if (saved !== null) {
    isFlightMode.value = JSON.parse(saved);
  }
};

// При монтировании компонента
onMounted(() => {
  loadFiles();
  connectToSSE();
  initFlightMode();
  
  // Подписываемся на события изменения Flight Mode
  window.addEventListener('flight-mode-changed', handleFlightModeChange);
  
  // Также слушаем события storage для синхронизации между вкладками
  window.addEventListener('storage', (event) => {
    if (event.key === FLIGHT_MODE_KEY) {
      isFlightMode.value = JSON.parse(event.newValue || 'false');
    }
  });
  
  console.log('EmailAttachmentsSection смонтирован');
});

// При размонтировании компонента
onUnmounted(() => {
  // Закрываем SSE соединение
  if (eventSource.value) {
    eventSource.value.close();
    console.log('EmailAttachmentsSection: SSE соединение закрыто');
  }
  
  // Отписываемся от событий Flight Mode
  window.removeEventListener('flight-mode-changed', handleFlightModeChange);
});
</script>

<style scoped>
@import './EmailAttachmentsSection.css';
</style>