<template>
  <section class="inventory-books-section section-list">
    <!-- Таблица книг -->
    <div class="section-list-grid">
      <!-- Состояние "нет книг" -->
      <div class="section-list-empty" v-if="!books.length && !isLoading">
        Книг нет
      </div>
      
      <!-- Состояние загрузки -->
      <div class="section-list-empty" v-if="isLoading">
        Загрузка...
      </div>

      <!-- Строки книг -->
      <template v-if="books.length > 0">
        <div class="section-list-row" v-for="book in books" :key="book.id">
          <!-- Колонка 1: Кнопка "Открыть книгу" -->
          <div class="section-list-cell">
            <button 
              class="section-list-action-btn" 
              title="Открыть книгу"
              @click="openBook(book.id)">
              <img src="/images/email-file_to_db.png" alt="Открыть книгу">
            </button>
          </div>
          
          <!-- Колонка 2: Контент (название + дата) -->
          <div class="section-list-cell section-list-content" @click="openBook(book.id)">
            <div class="book-name">{{ book.name }}</div>
            <div class="section-list-date">{{ formatDate(book.createdAt) }}</div>
          </div>
          
          <!-- Колонка 3: Кнопка "Редактировать" (только онлайн) -->
          <div class="section-list-cell">
            <button 
              v-if="!isFlightMode"
              class="section-list-action-btn" 
              title="Редактировать книгу"
              @click="editBook(book.id)">
              <img src="/images/email-file_delete.png" alt="Редактировать">
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
import { inventoryBookService } from '@/services/inventory-book.service';
import { useSSE } from '@/composables/useSSE';

const FLIGHT_MODE_KEY = 'u40ta_flight_mode';

const isLoading = ref(true);
const books = ref([]);
const router = useRouter();
const isFlightMode = ref(false);

const emit = defineEmits(['edit-book']);

/**
 * Проверяет, активен ли режим полёта
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
 */
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU');
};

/**
 * Открытие книги — переход на страницу /inventory-book/[id]
 */
const openBook = (bookId) => {
  router.push(`/inventory-book/${bookId}`);
};

/**
 * Редактирование книги — открывает модалку в Home
 */
const editBook = (bookId) => {
  emit('edit-book', bookId);
};

/**
 * Обработчик SSE сообщений
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

<style scoped>
@import './SectionList.css';
</style>