<template>
  <section class="max-w-[1000px] mx-auto px-4 w-full">
    <!-- Таблица ведомостей -->
    <div class="grid grid-cols-[auto_1fr_auto] gap-4 items-center max-w-[1000px] mx-auto">
      <!-- Состояние "нет ведомостей" -->
      <div v-if="!statements.length && !isLoading" class="col-span-3 text-center py-12 text-gray-500 italic text-lg">
        Ведомостей нет
      </div>
      
      <!-- Состояние загрузки -->
      <div v-if="isLoading" class="col-span-3 text-center py-12 text-gray-500 italic text-lg">
        Загрузка...
      </div>

      <!-- Строки ведомостей -->
      <template v-if="statements.length > 0">
        <template v-for="stmt in statements" :key="stmt.receivedAt">
          <!-- Колонка 1: пусто (место для иконки ушло) -->
          <div class="py-4 px-2"></div>
          
          <!-- Колонка 2: Контент (кликабельно) -->
          <div 
            class="py-4 px-2 flex flex-col gap-1 border-b border-gray-200 cursor-pointer"
            @click="openStatement(stmt)"
          >
            <div class="text-[0.95rem] text-gray-800">
              {{ formatDate(stmt.receivedAt) }}
            </div>
            <div class="font-bold text-blue-600 text-base">
              {{ stmt.description }}
            </div>
          </div>
          
          <!-- Колонка 3: Кнопка "Удалить" -->
          <div class="py-4 px-2">
            <button 
              class="bg-transparent border-none cursor-pointer p-1.5 transition-all duration-200 rounded hover:scale-115 hover:bg-gray-100"
              title="Удалить"
              @click="deleteStatement(stmt.receivedAt)"
              :disabled="isFlightMode"
              v-if="!isFlightMode"
            >
              <svg width="32" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M8.53113 1C5.52364 1 3.19671 3.63591 3.56974 6.62017L5.28873 20.3721C5.47639 21.8734 6.7526 23 8.26557 23H15.7344C17.2474 23 18.5236 21.8734 18.7113 20.3721L20.4303 6.62017C20.8033 3.63591 18.4764 1 15.4689 1H8.53113ZM5.70148 5C6.11066 3.8455 7.21175 3 8.53113 3H15.4689C16.7883 3 17.8893 3.8455 18.2985 5H5.70148ZM5.63279 7L7.27329 20.124C7.33584 20.6245 7.76124 21 8.26557 21H15.7344C16.2388 21 16.6642 20.6245 16.7267 20.124L18.3672 7H5.63279Z" fill="currentColor"/>
                <path d="M15.002 10.998C14.6114 10.6075 13.9783 10.6075 13.5878 10.998L12 12.5858L10.4201 11.0058C10.0296 10.6153 9.3964 10.6153 9.00587 11.0058C8.61535 11.3964 8.61535 12.0295 9.00587 12.4201L10.5858 14L9.00001 15.5858C8.60949 15.9763 8.60949 16.6095 9.00001 17C9.39054 17.3905 10.0237 17.3905 10.4142 17L12 15.4142L13.5878 17.0019C13.9783 17.3925 14.6114 17.3925 15.002 17.0019C15.3925 16.6114 15.3925 15.9782 15.002 15.5877L13.4142 14L15.002 12.4123C15.3925 12.0217 15.3925 11.3886 15.002 10.998Z" fill="currentColor"/>
              </svg>
            </button>
            <div v-else class="w-[26px] h-[26px]"></div>
          </div>
        </template>
      </template>
    </div>
  </section>

  <!-- Временная кнопка проверки почты -->
  <div v-if="!isFlightMode" class="flex justify-center py-4">
    <button 
      @click="checkEmail"
      class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap justify-self-center
             bg-gray-900 text-white hover:bg-gray-700 active:bg-gray-600"
    >
      Проверить почту
    </button>
  </div>
    
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router'
import { statementService } from '@/services/statement.service';
import { emailService } from '@/services/email.service';

// Константы
const FLIGHT_MODE_KEY = 'u40ta_flight_mode';
const EMAIL_CHECK_INTERVAL = 5 * 60 * 1000; // 5 минут

// Состояния компонента
const isLoading = ref(true);
const statements = ref([]);
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

/**
 * Загрузка списка ведомостей.
 */
const loadStatements = async () => {
  isLoading.value = true;
  try {
    statements.value = await statementService.getList();
  } catch (error) {
    console.error('Ошибка загрузки ведомостей:', error);
    statements.value = [];
  } finally {
    isLoading.value = false;
  }
};

/**
 * Форматирование даты для отображения.
 * @param {string} dateString - дата в ISO формате
 * @returns {string} отформатированная дата
 */
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU');
};

/**
 * Проверка почты — недоступна в офлайн-режиме.
 */
const checkEmail = async () => {
  if (isFlightMode.value) return;
  
  try {
    const result = await emailService.checkEmail();
    console.log('StatementsSection: результат проверки почты:', result);
    
    // Обновляем список после проверки
    if (result.success) {
      await loadStatements();
    }
  } catch (error) {
    console.error('StatementsSection: ошибка проверки почты:', error);
  }
};

/**
 * Удаление ведомости — недоступно в офлайн-режиме.
 * @param {string} receivedAt - дата получения ведомости
 */
const deleteStatement = async (receivedAt) => {
  if (!confirm('Удалить эту ведомость?')) return;
  
  try {
    const result = await statementService.deleteStatement(receivedAt);
    
    if (result.success) {
      statements.value = statements.value.filter(s => s.receivedAt !== receivedAt);
      console.log('StatementsSection: ведомость удалена');
    } else {
      console.error('StatementsSection: ошибка удаления:', result.message);
    }
  } catch (error) {
    console.error('StatementsSection: ошибка при удалении ведомости:', error);
  }
};

/**
 * Переход на страницу ведомости.
 * @param {Object} stmt - объект ведомости { receivedAt, description, docType }
 */
const openStatement = (stmt) => {
  router.push(`/statement/${encodeURIComponent(stmt.receivedAt)}`);
};

// ============================================================================
// ОБРАБОТЧИКИ FLIGHT MODE
// ============================================================================

/**
 * Обработчик изменения состояния Flight Mode.
 */
const handleFlightModeChange = (event) => {
  isFlightMode.value = event.detail.isFlightMode;
  console.log('StatementsSection: Flight Mode изменён:', isFlightMode.value);
  
  loadStatements();
  
  if (isFlightMode.value) {
    stopEmailCheckTimer();
  } else {
    startEmailCheckTimer();
  }
};

/**
 * Инициализация состояния Flight Mode из localStorage.
 */
const initFlightMode = () => {
  const saved = localStorage.getItem(FLIGHT_MODE_KEY);
  if (saved !== null) {
    isFlightMode.value = JSON.parse(saved);
  }
};

// ============================================================================
// ЖИЗНЕННЫЙ ЦИКЛ
// ============================================================================

onMounted(() => {
  loadStatements();
  initFlightMode();
  startEmailCheckTimer();
  
  window.addEventListener('flight-mode-changed', handleFlightModeChange);
  
  window.addEventListener('storage', (event) => {
    if (event.key === FLIGHT_MODE_KEY) {
      isFlightMode.value = JSON.parse(event.newValue || 'false');
      loadStatements();
      
      if (isFlightMode.value) {
        stopEmailCheckTimer();
      } else {
        startEmailCheckTimer();
      }
    }
  });
  
  console.log('StatementsSection смонтирован');
});

onUnmounted(() => {
  stopEmailCheckTimer();
  window.removeEventListener('flight-mode-changed', handleFlightModeChange);
});
</script>