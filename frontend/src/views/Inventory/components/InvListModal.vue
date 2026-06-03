<template>
  <Transition name="modal">
    <div v-if="isOpen" class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" @click.self="handleClose">
      <div class="modal-container bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden" style="width: 600px; max-width: 90vw; max-height: 85vh;">
        
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 class="text-lg font-semibold text-gray-900">{{ modalTitle }}</h3>
          <button 
            class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400
                   active:bg-gray-100 active:text-gray-900"
            @click="handleClose"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div class="overflow-y-auto flex-1 p-5">
          <div v-if="isLoading" class="py-10 text-center text-gray-500">Загрузка данных...</div>

          <div v-else-if="error" class="py-10 text-center text-red-600">
            {{ error }}
            <button @click="loadData" class="mt-4 px-4 py-2 bg-red-500 text-white rounded-md text-sm font-medium active:bg-red-600">
              Повторить
            </button>
          </div>

          <div v-else class="max-h-[400px] overflow-y-auto border border-gray-200 rounded-lg">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th class="sticky top-0 z-10 bg-gray-50 px-2 py-3 text-left font-semibold text-gray-800 border-b-2 border-gray-200 w-[50px] text-center">№</th>
                  <th class="sticky top-0 z-10 bg-gray-50 px-2 py-3 text-left font-semibold text-gray-800 border-b-2 border-gray-200">Местоположение</th>
                  <th class="sticky top-0 z-10 bg-gray-50 px-3 py-3 text-right font-semibold text-gray-800 border-b-2 border-gray-200 w-[140px]">Статус</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in combinedItems" :key="item._key" class="active:bg-gray-50">
                  <td class="px-2 py-2.5 border-b border-gray-100 text-center text-gray-500 font-medium">{{ index + 1 }}</td>
                  <td class="px-2 py-2.5 border-b border-gray-100 text-gray-600">{{ item._locationDisplay }}</td>
                  <td class="px-3 py-2.5 border-b border-gray-100 text-right">
                    <button 
                      @click="openCheckModal(item)"
                      :class="item._isConfirmed 
                        ? 'px-3 py-1.5 bg-green-100 text-green-700 border border-green-300 rounded-md text-xs font-medium active:bg-green-200'
                        : 'px-3 py-1.5 bg-blue-500 text-white border border-blue-600 rounded-md text-xs font-medium active:bg-blue-600'"
                    >
                      {{ item._isConfirmed ? 'Подтверждено' : 'Подтвердить наличие' }}
                    </button>
                  </td>
                </tr>
                <tr v-if="combinedItems.length === 0">
                  <td colspan="3" class="text-center py-10 text-gray-400 italic">Нет данных для отображения</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { objectService } from '@/services/object-service'
import { inventoryBookService } from '@/services/inventory-book.service'

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  invNumber: { type: String, required: true },
  partyNumber: { type: String, default: null },
  zavod: { type: [Number, String], required: true },
  sklad: { type: String, required: true },
  idBook: { type: [Number, String], required: true }
})

const emit = defineEmits(['close', 'saved', 'openCheckModal'])

const isLoading = ref(false)
const error = ref('')
const bookItemRows = ref([])
const objectRows = ref([])

const modalTitle = computed(() => `Инв. № ${props.invNumber} / Склад ${props.sklad}`)

const getLocationDisplay = (item) => {
  if (item.placeUser && item.placeUser.length >= 3) return item.placeUser
  if (item.placeCab && item.placeCab.length >= 3) return item.placeCab
  if (item.placePos && item.placePos.length >= 3) return item.placePos
  if (item.placeTer && item.placeTer.length >= 3) return item.placeTer
  return '—'
}

const buildObjectData = (obj) => ({
  idObject: obj.id,
  placeTer: obj.placeTer || null,
  placePos: obj.placePos || null,
  placeCab: obj.placeCab || null,
  placeUser: obj.placeUser || null
})

const pickFirst = (rows, field) => {
  for (const row of rows) {
    if (row[field] != null) return row[field]
  }
  return null
}

const combinedItems = computed(() => {
  const items = []
  
  for (const obj of objectRows.value) {
    const linkedRows = bookItemRows.value.filter(row => row.idObject === obj.id)
    
    const unconfirmedIds = linkedRows.filter(row => !row.isOkManual && !row.isOkAuto).map(row => row.id)
    const confirmedIds = linkedRows.filter(row => row.isOkManual || row.isOkAuto).map(row => row.id)
    
    if (unconfirmedIds.length > 0) {
      items.push({
        _key: `obj-${obj.id}-unconfirmed`,
        _locationDisplay: getLocationDisplay(obj),
        _isConfirmed: false,
        _itemIds: unconfirmedIds,
        _maxCount: unconfirmedIds.length,
        _objectData: buildObjectData(obj),
        _isOkManual: false,
        _isOkAuto: false,
        _dateOkManualChecked: null,
        _dateOkAutoChecked: null,
        _idUserOkManualChecked: null,
        _idUserOkAutoChecked: null,
        _existingRem: pickFirst(linkedRows, 'rem')
      })
    }
    
    if (confirmedIds.length > 0) {
      const confirmedRows = linkedRows.filter(row => row.isOkManual || row.isOkAuto)
      items.push({
        _key: `obj-${obj.id}-confirmed`,
        _locationDisplay: getLocationDisplay(obj),
        _isConfirmed: true,
        _itemIds: confirmedIds,
        _maxCount: confirmedIds.length,
        _objectData: buildObjectData(obj),
        _isOkManual: confirmedRows.some(row => row.isOkManual),
        _isOkAuto: confirmedRows.some(row => row.isOkAuto),
        _dateOkManualChecked: pickFirst(confirmedRows, 'dateOkManualChecked'),
        _dateOkAutoChecked: pickFirst(confirmedRows, 'dateOkAutoChecked'),
        _idUserOkManualChecked: pickFirst(confirmedRows, 'idUserOkManualChecked'),
        _idUserOkAutoChecked: pickFirst(confirmedRows, 'idUserOkAutoChecked'),
        _existingRem: pickFirst(confirmedRows, 'rem')
      })
    }
  }
  
  const noObjectRows = bookItemRows.value.filter(row => !row.idObject)
  
  const noObjectUnconfirmed = noObjectRows.filter(row => !row.isOkManual && !row.isOkAuto)
  if (noObjectUnconfirmed.length > 0) {
    items.push({
      _key: 'no-object-unconfirmed',
      _locationDisplay: 'нет в базе',
      _isConfirmed: false,
      _itemIds: noObjectUnconfirmed.map(row => row.id),
      _maxCount: noObjectUnconfirmed.length,
      _objectData: null,
      _isOkManual: false,
      _isOkAuto: false,
      _dateOkManualChecked: null,
      _dateOkAutoChecked: null,
      _idUserOkManualChecked: null,
      _idUserOkAutoChecked: null,
      _existingRem: pickFirst(noObjectUnconfirmed, 'rem')
    })
  }
  
  const noObjectConfirmed = noObjectRows.filter(row => row.isOkManual || row.isOkAuto)
  if (noObjectConfirmed.length > 0) {
    items.push({
      _key: 'no-object-confirmed',
      _locationDisplay: 'нет в базе',
      _isConfirmed: true,
      _itemIds: noObjectConfirmed.map(row => row.id),
      _maxCount: noObjectConfirmed.length,
      _objectData: null,
      _isOkManual: noObjectConfirmed.some(row => row.isOkManual),
      _isOkAuto: noObjectConfirmed.some(row => row.isOkAuto),
      _dateOkManualChecked: pickFirst(noObjectConfirmed, 'dateOkManualChecked'),
      _dateOkAutoChecked: pickFirst(noObjectConfirmed, 'dateOkAutoChecked'),
      _idUserOkManualChecked: pickFirst(noObjectConfirmed, 'idUserOkManualChecked'),
      _idUserOkAutoChecked: pickFirst(noObjectConfirmed, 'idUserOkAutoChecked'),
      _existingRem: pickFirst(noObjectConfirmed, 'rem')
    })
  }
  
  return items
})

const loadData = async () => {
  isLoading.value = true
  error.value = ''
  
  try {
    const allBookItems = await inventoryBookService.getBookItems(props.idBook)
    
    bookItemRows.value = allBookItems.filter(item => {
      if (item.invNumber !== props.invNumber) return false
      if (props.partyNumber !== null && props.partyNumber !== undefined && item.partyNumber !== props.partyNumber) return false
      if (Number(item.zavod) !== Number(props.zavod)) return false
      if (item.sklad !== props.sklad) return false
      return true
    })
    
    objectRows.value = await objectService.getObjectsByInv(
      props.invNumber, props.partyNumber, props.zavod, props.sklad
    )
  } catch (err) {
    error.value = err.message || 'Не удалось загрузить данные'
  } finally {
    isLoading.value = false
  }
}

const openCheckModal = (item) => {
  emit('openCheckModal', {
    mode: 'manual',
    itemIds: item._itemIds,
    maxCount: item._maxCount,
    objectData: item._objectData,
    isOkManual: item._isOkManual,
    isOkAuto: item._isOkAuto,
    dateOkManualChecked: item._dateOkManualChecked,
    dateOkAutoChecked: item._dateOkAutoChecked,
    idUserOkManualChecked: item._idUserOkManualChecked,
    idUserOkAutoChecked: item._idUserOkAutoChecked,
    existingRem: item._existingRem
  })
}

const handleClose = () => emit('close')

watch(() => props.isOpen, async (newVal) => {
  if (newVal) {
    await loadData()
  } else {
    bookItemRows.value = []
    objectRows.value = []
    error.value = ''
  }
}, { immediate: true })
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s cubic-bezier(0.2, 0.9, 0.4, 1.1);
}
.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95) translateY(-5px);
}
</style>  