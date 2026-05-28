<template>
  <section class="inventory-books-section max-w-[1000px] mx-auto px-4 w-full">
    <!-- Состояние "нет книг" -->
    <div v-if="!books.length && !isLoading" class="text-center py-12 text-gray-500 italic text-base">
      Инвентаризаций не ожидается
    </div>
    
    <!-- Состояние загрузки -->
    <div v-if="isLoading" class="text-center py-12 text-gray-500 italic text-base">
      Загрузка...
    </div>

    <!-- Строки книг (грид-таблица) -->
    <div v-if="books.length > 0" class="grid grid-cols-[auto_1fr_auto] gap-4 items-center max-w-[1000px] mx-auto">
      <template v-for="book in books" :key="book.id">
        <!-- Колонка 1: заглушка -->
        <div class="py-4 px-2"></div>
        
        <!-- Колонка 2: Контент (название + дата) -->
        <div 
          class="py-4 px-2 flex flex-col gap-1 border-b border-gray-100 cursor-pointer"
          @click="openBook(book.id)"
        >
          <div class="font-bold text-red-700 text-base">{{ book.name }}</div>
          <div class="text-gray-700 text-sm">{{ formatDate(book.createdAt) }}</div>
        </div>
        
        <!-- Колонка 3: Кнопка "Редактировать" (только онлайн) -->
        <div class="py-4 px-2 flex justify-end">
          <button 
            v-if="!isFlightMode && book.isOwner"
            class="p-1.5 rounded transition-all hover:scale-110 hover:bg-gray-100"
            title="Редактировать книгу"
            @click="editBook(book.id)"
          >
            <img src="/images/invBook_edit.png" alt="Редактировать" class="w-[26px] h-[26px] block">
          </button>
          <div v-else class="w-[26px] h-[26px]"></div>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router'
import { inventoryBookService } from '@/services/inventory-book.service';
import { useSSE } from '@/composables/useSSE';

const FLIGHT_MODE_KEY = 'u40ta_flight_mode';

const isLoading = ref(true);
const books = ref([]);
const router = useRouter();
const isFlightMode = ref(false);

const emit = defineEmits(['edit-inventory-book']);

/**
 * Проверяет, активен ли режим полёта
 * @returns {boolean}
 */
const checkFlightMode = () => {
  return localStorage.getItem(FLIGHT_MODE_KEY) === 'true';
};

/**
 * Загрузка списка книг
 */
const loadBooks = async () => {
  isLoading.value = true;
  try {
    books.value = await inventoryBookService.getAllBooks();
  } catch (error) {
    console.error('Ошибка загрузки книг:', error);
    books.value = [];
  } finally {
    isLoading.value = false;
  }
};

/**
 * Форматирование даты для отображения
 * @param {string} dateString
 * @returns {string}
 */
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU');
};

/**
 * Открытие книги — переход на страницу /inventory-book/[id]
 * @param {number} bookId
 */
const openBook = (bookId) => {
  router.push(`/inventory-book/${bookId}`);
};

/**
 * Редактирование книги — открывает модалку в Home
 * @param {number} bookId
 */
const editBook = (bookId) => {
  emit('edit-inventory-book', bookId);
};

/**
 * Обработчик SSE сообщений
 * @param {Object} data
 */
const handleSSEMessage = (data) => {
  console.log('InventoryBooksSection: получено SSE-событие:', data);
  
  if (data.type === 'inventory-book-changed' || data.type === 'access-changed') {
    console.log('InventoryBooksSection: обновление списка книг');
    loadBooks();
  }
};

// Подключаем SSE
useSSE(handleSSEMessage, { autoConnect: !checkFlightMode() });

/**
 * Обработчик изменения Flight Mode
 * @param {CustomEvent} event
 */
const handleFlightModeChange = (event) => {
  isFlightMode.value = event.detail.isFlightMode;
  console.log('InventoryBooksSection: Flight Mode изменён:', isFlightMode.value);
  loadBooks();
};

/**
 * Инициализация Flight Mode из localStorage
 */
const initFlightMode = () => {
  const saved = localStorage.getItem(FLIGHT_MODE_KEY);
  if (saved !== null) {
    isFlightMode.value = JSON.parse(saved);
  }
};

onMounted(() => {
  loadBooks();
  initFlightMode();
  
  window.addEventListener('flight-mode-changed', handleFlightModeChange);
  
  window.addEventListener('storage', (event) => {
    if (event.key === FLIGHT_MODE_KEY) {
      isFlightMode.value = JSON.parse(event.newValue || 'false');
      loadBooks();
    }
  });
  
  console.log('InventoryBooksSection смонтирован');
});

onUnmounted(() => {
  window.removeEventListener('flight-mode-changed', handleFlightModeChange);
});
</script>