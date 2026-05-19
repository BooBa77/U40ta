<template>
  <BaseModal
    :is-open="isOpen"
    :title="isEditMode ? 'Редактирование книги' : 'Новая инвентаризация'"
    width="600px"
    @close="$emit('close')"
  >
    <!-- Поле названия книги -->
    <div class="field">
      <label class="field-label">Название книги</label>
      <input
        v-model="bookName"
        type="text"
        class="field-input"
        placeholder="Введите название"
        :disabled="isSaving"
      />
    </div>

    <!-- Список batch'ей (только при создании) -->
    <div v-if="!isEditMode" class="batches-section">
      <label class="field-label">Выберите ведомости</label>

      <!-- Загрузка -->
      <div v-if="isLoadingBatches" class="batches-empty">
        Загрузка...
      </div>

      <!-- Нет batch'ей -->
      <div v-else-if="batches.length === 0" class="batches-empty">
        Нет доступных ведомостей
      </div>

      <!-- Скроллящийся список -->
      <div v-else class="batches-list">
        <div
          v-for="batch in batches"
          :key="batchKey(batch)"
          class="batch-row"
        >
          <label class="batch-label">
            <input
              v-model="selectedBatches"
              type="checkbox"
              :value="batchKey(batch)"
              :disabled="isSaving"
            />
            <span class="batch-info">
              <span class="batch-date">{{ formatDate(batch.receivedAt) }}</span>
              <span class="batch-name">{{ batch.docType }} — {{ batch.sklad }}</span>
              <span class="batch-count">{{ batch.count }} строк</span>
            </span>
          </label>
          <button
            class="batch-delete"
            title="Удалить ведомость"
            :disabled="isSaving"
            @click="deleteBatch(batch)"
          >
            🗑
          </button>
        </div>
      </div>
    </div>

    <!-- Кнопка удаления книги (только при редактировании) -->
    <div v-if="isEditMode" class="danger-section">
      <button
        class="modal-btn modal-btn-danger"
        :disabled="isSaving"
        @click="handleDeleteBook"
      >
        Удалить книгу
      </button>
    </div>

    <template #footer>
      <button
        class="modal-btn modal-btn-outline"
        @click="$emit('close')"
      >
        {{ isEditMode ? 'Назад' : 'Отмена' }}
      </button>
      <button
        v-if="isEditMode"
        class="modal-btn modal-btn-primary"
        :disabled="isSaving || !bookName.trim()"
        @click="handleSave"
      >
        {{ isSaving ? 'Сохранение...' : 'Сохранить' }}
      </button>
      <button
        v-else
        class="modal-btn modal-btn-primary"
        :disabled="isSaving || !bookName.trim() || selectedBatches.length === 0"
        @click="handleCreate"
      >
        {{ isSaving ? 'Создание...' : 'Создать' }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import { inventoryStatementsService } from '@/services/inventory-statements.service'
import { inventoryBookService } from '@/services/inventory-book.service'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  bookId: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['close', 'saved', 'deleted'])

// Режимы
const isEditMode = computed(() => props.bookId !== null)

// Состояния
const bookName = ref('')
const isSaving = ref(false)
const isLoadingBatches = ref(false)
const batches = ref([])
const selectedBatches = ref([])

/**
 * Уникальный ключ batch'а
 */
const batchKey = (batch) => {
  return `${batch.emailFrom}|${batch.receivedAt}|${batch.zavod}|${batch.sklad}`
}

/**
 * Форматирование даты
 */
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU')
}

/**
 * Загрузка batch'ей (только при создании)
 */
const loadBatches = async () => {
  isLoadingBatches.value = true
  try {
    batches.value = await inventoryStatementsService.getBatches()
  } catch (error) {
    console.error('Ошибка загрузки batch\'ей:', error)
    batches.value = []
  } finally {
    isLoadingBatches.value = false
  }
}

/**
 * Загрузка данных книги (при редактировании)
 */
const loadBook = async () => {
  if (!props.bookId) return
  
  try {
    const book = await inventoryBookService.getBook(props.bookId)
    bookName.value = book.name || ''
  } catch (error) {
    console.error('Ошибка загрузки книги:', error)
  }
}

/**
 * Удаление batch'а
 */
const deleteBatch = async (batch) => {
  if (!confirm('Удалить эту ведомость безвозвратно?')) return
  
  try {
    await inventoryStatementsService.deleteBatch(
      batch.emailFrom,
      batch.receivedAt,
      batch.zavod,
      batch.sklad
    )
    batches.value = batches.value.filter(b => batchKey(b) !== batchKey(batch))
    // Убираем из выбранных, если был выбран
    selectedBatches.value = selectedBatches.value.filter(k => k !== batchKey(batch))
  } catch (error) {
    console.error('Ошибка удаления batch\'а:', error)
    alert('Не удалось удалить ведомость')
  }
}

/**
 * Создание книги
 */
const handleCreate = async () => {
  if (!bookName.value.trim() || selectedBatches.value.length === 0) return
  
  isSaving.value = true
  
  try {
    // Загружаем строки выбранных batch'ей
    const allItems = []
    
    for (const key of selectedBatches.value) {
      const [emailFrom, receivedAt, zavod, sklad] = key.split('|')
      const items = await inventoryStatementsService.getBatchItems(
        emailFrom,
        receivedAt,
        Number(zavod),
        sklad
      )
      
      // Маппим строки в формат InventoryBookItem
      const mappedItems = items.map(item => ({
        idInventoryStatement: item.id,
        zavod: item.zavod,
        sklad: item.sklad,
        invNumber: item.invNumber,
        partyNumber: item.partyNumber,
        buhName: item.buhName,
      }))
      
      allItems.push(...mappedItems)
    }
    
    await inventoryBookService.createBook(bookName.value.trim(), allItems)
    emit('saved')
    emit('close')
  } catch (error) {
    console.error('Ошибка создания книги:', error)
    alert('Не удалось создать книгу')
  } finally {
    isSaving.value = false
  }
}

/**
 * Сохранение изменений книги
 */
const handleSave = async () => {
  if (!bookName.value.trim() || !props.bookId) return
  
  // Пока только название — позже добавим другие поля
  isSaving.value = true
  
  try {
    // TODO: добавить метод updateBook в сервис
    alert('Сохранение будет реализовано позже')
  } finally {
    isSaving.value = false
  }
}

/**
 * Удаление книги
 */
const handleDeleteBook = async () => {
  if (!confirm('Удалить книгу безвозвратно? Это действие нельзя отменить.')) return
  if (!props.bookId) return
  
  isSaving.value = true
  
  try {
    await inventoryBookService.deleteBook(props.bookId)
    emit('deleted')
    emit('close')
  } catch (error) {
    console.error('Ошибка удаления книги:', error)
    alert('Не удалось удалить книгу')
  } finally {
    isSaving.value = false
  }
}

/**
 * Сброс состояний при закрытии
 */
const reset = () => {
  bookName.value = ''
  selectedBatches.value = []
  batches.value = []
}

// Следим за открытием модалки
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    if (props.bookId) {
      loadBook()
    } else {
      loadBatches()
    }
  } else {
    reset()
  }
})
</script>

<style scoped>
/* Поле ввода */
.field {
  margin-bottom: 16px;
}

.field-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 4px;
}

.field-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.field-input:focus {
  outline: none;
  border-color: #3b82f6;
}

/* Секция batch'ей */
.batches-section {
  margin-top: 8px;
}

.batches-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.batches-empty {
  text-align: center;
  padding: 24px;
  color: #9ca3af;
  font-style: italic;
}

.batch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #f3f4f6;
}

.batch-row:last-child {
  border-bottom: none;
}

.batch-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  flex: 1;
}

.batch-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.batch-date {
  font-size: 12px;
  color: #6b7280;
}

.batch-name {
  font-weight: 500;
  font-size: 13px;
}

.batch-count {
  font-size: 12px;
  color: #9ca3af;
}

.batch-delete {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.batch-delete:hover:not(:disabled) {
  background-color: #fee2e2;
}

.batch-delete:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Кнопка удаления книги */
.danger-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.modal-btn-danger {
  background-color: #ef4444;
  color: white;
  width: 100%;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  font-family: inherit;
}

.modal-btn-danger:hover:not(:disabled) {
  background-color: #dc2626;
}

.modal-btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Скроллбар для списка batch'ей */
.batches-list::-webkit-scrollbar {
  width: 4px;
}

.batches-list::-webkit-scrollbar-track {
  background: #f1f3f5;
  border-radius: 4px;
}

.batches-list::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
</style>