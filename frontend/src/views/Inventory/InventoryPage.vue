<template>
  <div class="h-screen flex flex-col p-5 bg-gray-50 overflow-hidden">

    <!-- Хедер убрал для экономии места-->

    <!-- Загрузка -->
    <div v-if="loading" class="flex-1 flex flex-col justify-center items-center text-blue-500 text-lg">
      Загрузка книги...
    </div>
    
    <!-- Ошибка -->
    <div v-else-if="error" class="flex-1 flex flex-col justify-center items-center text-red-600 text-lg gap-4">
      {{ error }}
      <button 
        @click="reload"
        class="px-5 py-2.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition"
      >
        Повторить
      </button>
    </div>
    
    <!-- Данные -->
    <div v-else class="flex-1 flex flex-col min-h-0">
      <!-- Универсальная модалка фильтра -->
      <UniversalFilterModal
        :is-open="filterModalState.isOpen"
        :title="filterModalState.title"
        :options="filterModalState.options"
        :selected-values="filterModalState.selectedValues"
        :is-loading="filterModalState.isLoading"
        @apply="applyFilter"
        @close="closeFilterModal"
        @reset="resetCurrentFilter"
      />

      <!-- Модалка детализации группы (список объектов) -->
      <InvListModal
        :is-open="invListIsOpen"
        :inv-number="selectedItem.invNumber"
        :party-number="selectedItem.partyNumber"
        :zavod="selectedItem.zavod"
        :sklad="selectedItem.sklad"
        :id-book="bookId"
        @close="handleInvListClose"
        @saved="reload"
        @openCheckModal="handleOpenCheckModalFromList"
      />

      <!-- Модалка подтверждения наличия (для ручного, QR и invalid режимов) -->
      <InventoryCheckModal
        :is-open="checkModalIsOpen"
        :mode="checkModalMode"
        :item-ids="checkModalItemIds"
        :max-count="checkModalMaxCount"
        :book-id="bookId"
        :inv-number="checkModalInvNumber"
        :party-number="checkModalPartyNumber"
        :sn="checkModalSn"
        :zavod="checkModalZavod"
        :sklad="checkModalSklad"
        :object-data="checkModalObjectData"
        :is-ok-manual="checkModalIsOkManual"
        :is-ok-auto="checkModalIsOkAuto"
        :date-ok-manual-checked="checkModalDateOkManualChecked"
        :date-ok-auto-checked="checkModalDateOkAutoChecked"
        :id-user-ok-manual-checked="checkModalIdUserOkManualChecked"
        :id-user-ok-auto-checked="checkModalIdUserOkAutoChecked"
        :existing-rem="checkModalExistingRem"
        @save="handleCheckSave"
        @cancel="handleCheckCancel"
      />

      <!-- Таблица -->
      <InventoryBookTable 
        ref="inventoryBookTableRef"
        :key="JSON.stringify(activeFiltersForTable)"
        :items="filteredItems"
        :get-row-class="getRowClass"
        :active-filters="activeFiltersForTable"
        @filter-click="handleFilterClick"
        @actual-change="handleActualChangeWithAnchor"
        @row-click="handleRowClick"
      />
    </div>

    <!-- Футер: назад + сканер + сброс фильтров -->
    <footer class="flex-shrink-0 bg-white border-t border-gray-200 p-3">
      <div class="flex items-center justify-between gap-3">
        <!-- Левая группа: назад (фиксированная ширина) -->
        <div class="w-[100px]">
          <button 
            class="border border-gray-300 text-gray-600 font-medium px-3 py-1.5 rounded-lg text-sm hover:bg-gray-100 transition whitespace-nowrap w-full"
            @click="goBack"
          >
            ← Назад
          </button>
        </div>

        <!-- Центр: сканер (центрируется абсолютно) -->
        <div class="absolute left-1/2 transform -translate-x-1/2">
          <QrScannerButton
            size="medium"
            @scan="handleQrScan"
            @error="handleScanError"
          />
        </div>

        <!-- Правая группа: сброс фильтров (фиксированная ширина, текст с переносом) -->
        <div class="w-[120px] flex justify-end">
          <button 
            v-if="hasActiveFilters" 
            @click="resetAllFilters"
            class="border border-amber-400 bg-amber-50 text-amber-700 font-medium px-3 py-1.5 rounded-lg text-sm hover:bg-amber-100 transition text-center"
            title="Сбросить все фильтры"
          >
            Сбросить фильтры
          </button>
        </div>
      </div>
    </footer>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import QrScannerButton from '@/components/QrScanner/ui/QrScannerButton.vue'
import UniversalFilterModal from '@/components/common/UniversalFilterModal.vue'
import InvListModal from '@/views/Inventory/components/InvListModal.vue'
import InventoryCheckModal from './components/InventoryCheckModal.vue'
import InventoryBookTable from './components/InventoryBookTable.vue'

// Композаблы
import { useInventoryBookData } from './composables/useInventoryBookData'
import { useInventoryAggregation } from './composables/table/useInventoryAggregation'
import { useTableFilter } from '@/composables/useTableFilter'
import { useActualManager } from './composables/table/useActualManager'
import { inventoryBookService } from '@/services/inventory-book.service'
import { qrService } from '@/services/qr.service'
import { objectService } from '@/services/object.service'

const route = useRoute()
const router = useRouter()
const bookId = Number(route.params.id)

// === ДАННЫЕ ===
const { loading, error, rawItems, reload } = useInventoryBookData(bookId)
const { aggregatedItems, getRowClass } = useInventoryAggregation(rawItems)

// === НАЗВАНИЕ КНИГИ ===
const bookName = ref('Загрузка...')

// === МЕНЕДЖЕР АКТУАЛЬНОСТИ ===
const actualManager = useActualManager(bookId, reload)

// === REF НА ТАБЛИЦУ ===
/** Ссылка на компонент InventoryBookTable для вызова scrollToAnchor */
const inventoryBookTableRef = ref(null)

onMounted(async () => {
  try {
    const book = await inventoryBookService.getBook(bookId)
    bookName.value = book.name
  } catch (err) {
    console.error('Ошибка загрузки книги:', err)
    bookName.value = 'Ошибка загрузки'
  }
})

// === КОНФИГУРАЦИЯ ФИЛЬТРОВ ===
const filterColumns = [
  {
    id: 'inv_number',
    title: 'Фильтр по инвентарному номеру',
    getValue: (row) => row.invNumber
  },
  {
    id: 'buh_name',
    title: 'Фильтр по наименованию',
    getValue: (row) => row.buhName
  }
]

// === ФИЛЬТР ===
const {
  filterModalState,
  hasActiveFilters,
  filteredData: filteredItems,
  openFilterModal,
  applyFilter,
  resetCurrentFilter,
  resetAllFilters,
  activeFilters
} = useTableFilter(aggregatedItems, filterColumns)

// === СОСТОЯНИЕ ДЛЯ InvListModal ===
const invListIsOpen = ref(false)
const selectedItem = ref({
  invNumber: '',
  partyNumber: null,
  zavod: 0,
  sklad: ''
})

// === СОСТОЯНИЕ ДЛЯ InventoryCheckModal ===
const checkModalIsOpen = ref(false)
const checkModalMode = ref('manual') // 'manual', 'auto', 'invalid'
const checkModalItemIds = ref([])
const checkModalMaxCount = ref(1)
const checkModalInvNumber = ref('')
const checkModalPartyNumber = ref(null)
const checkModalSn = ref(null)
const checkModalZavod = ref(0)
const checkModalSklad = ref('')
const checkModalObjectData = ref(null)
const checkModalIsOkManual = ref(false)
const checkModalIsOkAuto = ref(false)
const checkModalDateOkManualChecked = ref(null)
const checkModalDateOkAutoChecked = ref(null)
const checkModalIdUserOkManualChecked = ref(null)
const checkModalIdUserOkAutoChecked = ref(null)
const checkModalExistingRem = ref(null)

// === COMPUTED ===
const activeFiltersForTable = computed(() => {
  const result = {}
  if (activeFilters.value.inv_number) {
    result.inv_number = activeFilters.value.inv_number
  }
  if (activeFilters.value.buh_name) {
    result.buh_name = activeFilters.value.buh_name
  }
  return result
})

// ============================================================
//  ОБРАБОТЧИК ИЗМЕНЕНИЯ АКТУАЛЬНОСТИ (с якорем)
// ============================================================

/**
 * Обработчик изменения актуальности с сохранением позиции скролла.
 * Вызывает actualManager, затем скроллит к якорю после перерисовки.
 * 
 * @param {Object} params
 * @param {string} params.invNumber - инвентарный номер
 * @param {boolean} params.isActual - новое значение
 * @param {Object|null} params.anchor - якорь, найденный в InventoryBookTable
 */
const handleActualChangeWithAnchor = async ({ invNumber, isActual, anchor }) => {
  await actualManager.handleActualChange({ invNumber, isActual })
  await nextTick()
  
  if (anchor && inventoryBookTableRef.value) {
    inventoryBookTableRef.value.scrollToAnchor(anchor)
  }
}

// === ОБРАБОТЧИКИ ===
const goBack = () => {
  resetAllFilters()
  router.push('/')
}

const handleFilterClick = (columnId) => {
  const mapping = {
    'inv_party_combined': 'inv_number',
    'buh_name': 'buh_name'
  }
  openFilterModal(mapping[columnId] || columnId)
}

const closeFilterModal = () => {
  filterModalState.value.isOpen = false
}

const handleRowClick = (groupParams) => {
  console.log('[InventoryPage] Клик по строке, открываем InvListModal')
  
  selectedItem.value = {
    invNumber: groupParams.invNumber,
    partyNumber: groupParams.partyNumber,
    zavod: groupParams.zavod,
    sklad: groupParams.sklad
  }
  
  invListIsOpen.value = true
}

// ============================================================
//  ОБРАБОТЧИК ЗАКРЫТИЯ InvListModal (с якорем)
// ============================================================

/**
 * Обработчик закрытия InvListModal.
 * Если в модалке были изменения — перезагружает данные и скроллит к якорю.
 * Если изменений не было — просто закрывает без reload.
 * 
 * @param {Object} params - параметры из модалки
 * @param {boolean} params.hasChanges - были ли изменения в модалке
 */
const handleInvListClose = async ({ hasChanges } = {}) => {
  // Запоминаем якорь до возможной перерисовки
  const anchor = {
    type: 'modal_close',
    invNumber: selectedItem.value.invNumber,
    partyNumber: selectedItem.value.partyNumber
  }

  invListIsOpen.value = false
  
  setTimeout(() => {
    selectedItem.value = {
      invNumber: '',
      partyNumber: null,
      zavod: 0,
      sklad: ''
    }
  }, 300)
  
  // Перезагружаем данные только если были изменения
  if (hasChanges) {
    await reload()
    await nextTick()
    
    if (inventoryBookTableRef.value) {
      inventoryBookTableRef.value.scrollToAnchor(anchor)
    }
  }
}

// === ОБРАБОТЧИК ИЗ InvListModal (ручной режим) ===
const handleOpenCheckModalFromList = (payload) => {
  console.log('[InventoryPage] Открываем InventoryCheckModal из списка:', payload)
  
  checkModalMode.value = 'manual'
  checkModalItemIds.value = payload.itemIds
  checkModalMaxCount.value = payload.maxCount
  checkModalObjectData.value = payload.objectData
  checkModalIsOkManual.value = payload.isOkManual
  checkModalIsOkAuto.value = payload.isOkAuto
  checkModalDateOkManualChecked.value = payload.dateOkManualChecked
  checkModalDateOkAutoChecked.value = payload.dateOkAutoChecked
  checkModalIdUserOkManualChecked.value = payload.idUserOkManualChecked
  checkModalIdUserOkAutoChecked.value = payload.idUserOkAutoChecked
  checkModalExistingRem.value = payload.existingRem
  
  // Данные из текущего selectedItem (InvListModal)
  checkModalInvNumber.value = selectedItem.value.invNumber
  checkModalPartyNumber.value = selectedItem.value.partyNumber
  checkModalZavod.value = selectedItem.value.zavod
  checkModalSklad.value = selectedItem.value.sklad
  checkModalSn.value = null
  
  checkModalIsOpen.value = true
}

// ============================================================
//  ОБРАБОТЧИКИ InventoryCheckModal (с якорем)
// ============================================================

/**
 * Обработчик сохранения в InventoryCheckModal.
 * Перезагружает данные и скроллит к якорю.
 * Если модалка открывалась из InvListModal — закрывает и её.
 */
const handleCheckSave = async () => {
  // Запоминаем якорь до перерисовки
  const anchor = {
    type: 'modal_close',
    invNumber: checkModalInvNumber.value,
    partyNumber: checkModalPartyNumber.value
  }

  checkModalIsOpen.value = false
  
  // Если модалка открывалась из InvListModal, закрываем и её
  if (invListIsOpen.value) {
    invListIsOpen.value = false
  }

  await reload()
  await nextTick()
  
  if (inventoryBookTableRef.value) {
    inventoryBookTableRef.value.scrollToAnchor(anchor)
  }
}

const handleCheckCancel = () => {
  checkModalIsOpen.value = false
}

// === QR-СКАНИРОВАНИЕ (автоматический режим) ===
const handleQrScan = async (qrCode) => {
  console.log('[InventoryPage] QR-скан в футере:', qrCode)
  
  try {
    // 1. Ищем QR-код в системе
    const qrResult = await qrService.findObjectByQrCode(qrCode)
    
    if (!qrResult || !qrResult.objectId) {
      alert('Данный код не зарегистрирован в системе')
      return
    }
    
    const objectId = qrResult.objectId
    
    // 2. Загружаем объект
    const object = await objectService.getObject(objectId)
    
    // 3. Ищем в inventory_book_items записи с таким objectId
    const allItems = await inventoryBookService.getBookItems(bookId)
    let foundItem = allItems.find(item => item.idObject === objectId)
    
    if (foundItem) {
      // Нашли по objectId - открываем модалку в auto-режиме с этой записью
      openCheckModalFromScan([foundItem.id], 1, object, foundItem)
      return
    }
    
    // 4. Не нашли по objectId - ищем по комбинации полей
    const candidateItems = allItems.filter(item => 
      item.invNumber === object.invNumber &&
      (item.partyNumber === object.partyNumber || (!item.partyNumber && !object.partyNumber)) &&
      Number(item.zavod) === Number(object.zavod) &&
      item.sklad === object.sklad
    )
    
    // Отфильтровываем записи с isOkAuto = true
    let availableItems = candidateItems.filter(item => !item.isOkAuto)
    
    if (availableItems.length === 0) {
      // Все записи уже подтверждены автоматически - invalid
      openCheckModalFromScan([], 0, object, null)
      return
    }
    
    // Сортируем: сначала isOkManual = false, потом isOkManual = true
    availableItems.sort((a, b) => {
      if (a.isOkManual === b.isOkManual) return 0
      return a.isOkManual ? 1 : -1
    })
    
    // Берём первую запись
    const targetItem = availableItems[0]
    openCheckModalFromScan([targetItem.id], 1, object, targetItem)
    
  } catch (error) {
    console.error('[InventoryPage] Ошибка при обработке QR-кода:', error)
    alert(error.message || 'Ошибка при обработке QR-кода')
  }
}

const openCheckModalFromScan = (itemIds, maxCount, object, existingItem) => {
  checkModalMode.value = 'auto'
  checkModalItemIds.value = itemIds
  checkModalMaxCount.value = maxCount
  checkModalObjectData.value = object.id ? {
    idObject: object.id,
    placeTer: object.placeTer,
    placePos: object.placePos,
    placeCab: object.placeCab,
    placeUser: object.placeUser
  } : null
  checkModalInvNumber.value = object.invNumber
  checkModalPartyNumber.value = object.partyNumber
  checkModalSn.value = object.sn || null
  checkModalZavod.value = object.zavod
  checkModalSklad.value = object.sklad
  
  if (existingItem) {
    checkModalIsOkManual.value = existingItem.isOkManual || false
    checkModalIsOkAuto.value = existingItem.isOkAuto || false
    checkModalDateOkManualChecked.value = existingItem.dateOkManualChecked || null
    checkModalDateOkAutoChecked.value = existingItem.dateOkAutoChecked || null
    checkModalIdUserOkManualChecked.value = existingItem.idUserOkManualChecked || null
    checkModalIdUserOkAutoChecked.value = existingItem.idUserOkAutoChecked || null
    checkModalExistingRem.value = existingItem.rem || null
  } else {
    checkModalIsOkManual.value = false
    checkModalIsOkAuto.value = false
    checkModalDateOkManualChecked.value = null
    checkModalDateOkAutoChecked.value = null
    checkModalIdUserOkManualChecked.value = null
    checkModalIdUserOkAutoChecked.value = null
    checkModalExistingRem.value = null
  }
  
  // Если нет itemIds - это invalid режим
  if (itemIds.length === 0) {
    checkModalMode.value = 'invalid'
  }
  
  checkModalIsOpen.value = true
}

const handleScanError = (error) => {
  console.error('[InventoryPage] Ошибка сканирования:', error)
  alert('Ошибка сканирования: ' + error)
}

</script>