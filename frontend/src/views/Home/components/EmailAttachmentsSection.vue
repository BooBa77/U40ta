<template>
  <section class="email-attachments-section section-list">
    <!-- Таблица файлов -->
    <div class="section-list-grid">
      <!-- Состояние "нет файлов" -->
      <div class="section-list-empty" v-if="!files.length && !isLoading">
        Файлов нет
      </div>
      
      <!-- Состояние загрузки -->
      <div class="section-list-empty" v-if="isLoading">
        Загрузка...
      </div>

      <!-- Строки файлов -->
      <template v-if="files.length > 0">
        <div class="section-list-row" v-for="file in files" :key="file.id">
          <!-- Колонка 1: Кнопка "Взять в работу" -->
          <div class="section-list-cell">
            <button 
              class="section-list-action-btn" 
              title="Открыть ведомость"
              @click="openStatement(file.id, file.isInventory, file.inProcess)">
              <span v-html="file.inProcess ? fireIcon : letterIcon"></span>
            </button>            
          </div>
          
          <!-- Колонка 2: Контент (3 строки) -->
          <div class="section-list-cell section-list-content" @click="openStatement(file.id, file.isInventory, file.inProcess)">
            <div class="section-list-date">{{ formatDate(file.receivedAt) }}</div>
            <div class="doc-info">{{ file.isInventory ? `Инвентаризация ${file.docType}` : file.docType + ' ' }}{{ file.sklad }}</div>
            <div class="sender">{{ file.emailFrom }}</div>
          </div>
          
          <!-- Колонка 3: Кнопка "Удалить файл" -->
          <div class="section-list-cell">
            <button 
              class="section-list-action-btn" 
              title="Удалить"
              @click="deleteAttachment(file.id)"
              :disabled="isFlightMode"
              v-if="!isFlightMode">
              <span v-html="deleteIcon"></span>
            </button>
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
import { emailAttachmentService } from '@/services/email-attachment.service';
import { useSSE } from '@/composables/useSSE';

// Константы
const FLIGHT_MODE_KEY = 'u40ta_flight_mode';
const EMAIL_CHECK_INTERVAL = 5 * 60 * 1000; // 5 минут

// Состояния компонента
const isLoading = ref(true);
const files = ref([]);
const router = useRouter();
const isFlightMode = ref(false);

// Таймер автопроверки почты
let emailCheckTimer = null;

/**
 * Проверяет, активен ли режим полёта
 */
const checkFlightMode = () => {
  return localStorage.getItem(FLIGHT_MODE_KEY) === 'true';
};

/**
 * Запуск таймера автопроверки почты.
 * Только в онлайн-режиме.
 */
const startEmailCheckTimer = () => {
  stopEmailCheckTimer();
  
  if (isFlightMode.value) return;
  
  emailCheckTimer = setInterval(() => {
    checkEmail();
  }, EMAIL_CHECK_INTERVAL);
};

/**
 * Остановка таймера автопроверки почты.
 */
const stopEmailCheckTimer = () => {
  if (emailCheckTimer) {
    clearInterval(emailCheckTimer);
    emailCheckTimer = null;
  }
};

// Загрузка файлов / обновление
const loadFiles = async () => {
  isLoading.value = true;
  try {
    files.value = await emailAttachmentService.getAllAttachments();
  } catch (error) {
    console.error('Ошибка загрузки файлов:', error);
    files.value = [];
  } finally {
    isLoading.value = false;
  }
};

// Форматирование даты для отображения
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU');
};

// Проверка почты — недоступна в офлайн-режиме
const checkEmail = async () => {
  if (isFlightMode.value) return;
  
  try {
    const result = await emailAttachmentService.checkEmail();
    console.log('EmailAttachmentsSection: результат проверки почты:', result);
  } catch (error) {
    console.error('EmailAttachmentsSection: ошибка проверки почты:', error);
  }
};

// Удаление вложения — недоступно в офлайн-режиме
const deleteAttachment = async (attachmentId) => {
  if (!confirm('Удалить это вложение?')) return;
  
  try {
    const result = await emailAttachmentService.deleteAttachment(attachmentId);
    
    if (result.success) {
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
    router.push(`/inventory/${attachmentId}`);
    return;
  }
  router.push(`/statement/${attachmentId}`);
};

/**
 * Обработчик SSE сообщений
 */
const handleSSEMessage = (data) => {
  console.log('EmailAttachmentsSection: распарсено SSE-событие:', data);
  
  if (data.type === 'statement-updated' || 
      data.type === 'statement-deleted' ||
      data.type === 'statement-active-changed' ||
      data.type === 'statement-loaded') {
    console.log('EmailAttachmentsSection: обновление списка ведомостей');
    loadFiles();
  }
};

// Подключаем SSE через композабл
useSSE(handleSSEMessage, { autoConnect: !checkFlightMode() });

// Обработчик изменения состояния Flight Mode
const handleFlightModeChange = (event) => {
  isFlightMode.value = event.detail.isFlightMode;
  console.log('EmailAttachmentsSection: Flight Mode изменён:', isFlightMode.value);
  
  loadFiles();
  
  // Перезапускаем таймер при выходе из офлайна
  if (isFlightMode.value) {
    stopEmailCheckTimer();
  } else {
    startEmailCheckTimer();
  }
};

// Инициализация состояния Flight Mode из localStorage
const initFlightMode = () => {
  const saved = localStorage.getItem(FLIGHT_MODE_KEY);
  if (saved !== null) {
    isFlightMode.value = JSON.parse(saved);
  }
};

// Иконки
// Иконка DELETE
const deleteIcon = `<svg width="32" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path fill-rule="evenodd" clip-rule="evenodd" d="M8.53113 1C5.52364 1 3.19671 3.63591 3.56974 6.62017L5.28873 20.3721C5.47639 21.8734 6.7526 23 8.26557 23H15.7344C17.2474 23 18.5236 21.8734 18.7113 20.3721L20.4303 6.62017C20.8033 3.63591 18.4764 1 15.4689 1H8.53113ZM5.70148 5C6.11066 3.8455 7.21175 3 8.53113 3H15.4689C16.7883 3 17.8893 3.8455 18.2985 5H5.70148ZM5.63279 7L7.27329 20.124C7.33584 20.6245 7.76124 21 8.26557 21H15.7344C16.2388 21 16.6642 20.6245 16.7267 20.124L18.3672 7H5.63279Z" fill="currentColor"/>
  <path d="M15.002 10.998C14.6114 10.6075 13.9783 10.6075 13.5878 10.998L12 12.5858L10.4201 11.0058C10.0296 10.6153 9.3964 10.6153 9.00587 11.0058C8.61535 11.3964 8.61535 12.0295 9.00587 12.4201L10.5858 14L9.00001 15.5858C8.60949 15.9763 8.60949 16.6095 9.00001 17C9.39054 17.3905 10.0237 17.3905 10.4142 17L12 15.4142L13.5878 17.0019C13.9783 17.3925 14.6114 17.3925 15.002 17.0019C15.3925 16.6114 15.3925 15.9782 15.002 15.5877L13.4142 14L15.002 12.4123C15.3925 12.0217 15.3925 11.3886 15.002 10.998Z" fill="currentColor"/>
</svg>`;

// Иконка LETTER (новое письмо)
const letterIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M2 12C2 8.22876 2 6.34315 3.17157 5.17157C4.34315 4 6.22876 4 10 4H14C17.7712 4 19.6569 4 20.8284 5.17157C22 6.34315 22 8.22876 22 12C22 15.7712 22 17.6569 20.8284 18.8284C19.6569 20 17.7712 20 14 20H10C6.22876 20 4.34315 20 3.17157 18.8284C2 17.6569 2 15.7712 2 12Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
  <path d="M6 8L8.1589 9.79908C9.99553 11.3296 10.9139 12.0949 12 12.0949C13.0861 12.0949 14.0045 11.3296 15.8411 9.79908L18 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
</svg>`;

// Иконка FIRE (текущая ведомость)
const fireIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M5.926 20.574a7.26 7.26 0 0 0 3.039 1.511c.107.035.179-.105.107-.175-2.395-2.285-1.079-4.758-.107-5.873.693-.796 1.68-2.107 1.608-3.865 0-.176.18-.317.322-.211 1.359.703 2.288 2.25 2.538 3.515.394-.386.537-.984.537-1.511 0-.176.214-.317.393-.176 1.287 1.16 3.503 5.097-.072 8.19-.071.071 0 .212.072.177a8.761 8.761 0 0 0 3.003-1.442c5.827-4.5 2.037-12.48-.43-15.116-.321-.317-.893-.106-.893.351-.036.95-.322 2.004-1.072 2.707-.572-2.39-2.478-5.105-5.195-6.441-.357-.176-.786.105-.75.492.07 3.27-2.063 5.352-3.922 8.059-1.645 2.425-2.717 6.89.822 9.808z" fill="currentColor"/>
</svg>`;
   




onMounted(() => {
  loadFiles();
  initFlightMode();
  startEmailCheckTimer();
  
  window.addEventListener('flight-mode-changed', handleFlightModeChange);
  
  window.addEventListener('storage', (event) => {
    if (event.key === FLIGHT_MODE_KEY) {
      isFlightMode.value = JSON.parse(event.newValue || 'false');
      loadFiles();
      
      if (isFlightMode.value) {
        stopEmailCheckTimer();
      } else {
        startEmailCheckTimer();
      }
    }
  });
  
  console.log('EmailAttachmentsSection смонтирован');
});

onUnmounted(() => {
  stopEmailCheckTimer();
  window.removeEventListener('flight-mode-changed', handleFlightModeChange);
});
</script>

<style scoped>
@import './SectionList.css';
</style>