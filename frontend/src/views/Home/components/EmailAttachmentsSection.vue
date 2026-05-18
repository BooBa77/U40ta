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
            <button class="section-list-action-btn" 
              title="Открыть ведомость"
              @click="openStatement(file.id, file.isInventory, file.inProcess)">
              <img 
                :src="file.inProcess 
                  ? '/images/open_processing_file.png' 
                  : '/images/email-file_to_db.png'" 
                alt="Открыть ведомость"
              />
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
              <img src="/images/email-file_delete.png" alt="Удалить">
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

// При монтировании компонента
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

// При размонтировании компонента
onUnmounted(() => {
  stopEmailCheckTimer();
  window.removeEventListener('flight-mode-changed', handleFlightModeChange);
});
</script>

<style scoped>
@import './SectionList.css';
</style>