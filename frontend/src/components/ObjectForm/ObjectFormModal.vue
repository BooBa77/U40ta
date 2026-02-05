<template>
  <BaseModal
    :is-open="isOpen"
    :title="''"
    :show-header="false"
    :width="'100vw'"
    :max-width="'100vw'"
    :max-height="'100vh'"
    @close="handleClose"
  >
    <!-- Контейнер с вертикальной прокруткой -->
    <div class="object-form-content">
      <!-- 1. Нередактируемые данные -->
      <div class="readonly-data">
        <div class="readonly-item buh-name">{{ formData.buh_name || '—' }}</div>
        <div class="readonly-item inv-number">{{ formData.inv_number || '—' }}</div>
        <div class="readonly-item sklad" v-if="formData.sklad || formData.zavod">
          Склад - {{ formData.sklad }}/{{ formData.zavod }}
        </div>
      </div>

      <!-- 2. Серийный номер -->
      <div class="form-field">
        <input
          type="text"
          v-model="formData.sn"
          placeholder="Серийный номер"
          class="input-field"
        />
      </div>

      <!-- 3. Местоположение -->
      <div class="location-section">
        <div class="form-field">
          <input
            type="text"
            v-model="place_ter"
            list="ter-list"
            placeholder="Территория"
            class="input-field combo-input"
            @change="onTerChange"
            @blur="saveNewPlace('ter', null, place_ter)"
          />
          <datalist id="ter-list">
            <option v-for="ter in placeOptions.ter" :key="ter" :value="ter" />
          </datalist>
        </div>

        <div class="form-field">
          <input
            type="text"
            v-model="place_pos"
            list="pos-list"
            placeholder="Помещение"
            class="input-field combo-input"
            :disabled="!place_ter"
            @change="onPosChange"
            @blur="saveNewPlace('pos', place_ter, place_pos)"
          />
          <datalist id="pos-list">
            <option v-for="pos in placeOptions.pos" :key="pos" :value="pos" />
          </datalist>
        </div>

        <div class="form-field">
          <input
            type="text"
            v-model="place_cab"
            list="cab-list"
            placeholder="Кабинет"
            class="input-field combo-input"
            :disabled="!place_pos"
            @change="onCabChange"
            @blur="saveNewPlace('cab', place_pos, place_cab)"
          />
          <datalist id="cab-list">
            <option v-for="cab in placeOptions.cab" :key="cab" :value="cab" />
          </datalist>
        </div>

        <div class="form-field">
          <input
            type="text"
            v-model="place_user"
            list="user-list"
            placeholder="Пользователь"
            class="input-field combo-input"
            :disabled="!place_cab"
            @blur="saveNewPlace('user', place_cab, place_user)"
          />
          <datalist id="user-list">
            <option v-for="user in placeOptions.user" :key="user" :value="user" />
          </datalist>
        </div>
      </div>

      <!-- 4. Строка действий -->
      <div class="actions-container">
        <div class="actions-buttons">
          <button class="btn-action" @click="addQrCode" type="button">
            Добавить QR-код
          </button>
          <button class="btn-action" @click="addPhoto" type="button">
            Добавить фото
          </button>
        </div>
        
        <!-- Карусель фото -->
        <div class="photos-carousel" v-if="photos.length > 0">
          <div class="photo-thumb" v-for="(photo, index) in photos" :key="index">
            <img :src="photo.thumb" alt="Фото" />
          </div>
        </div>
      </div>

      <!-- 5. Комментарий -->
      <div class="form-field">
        <textarea
          v-model="formData.comment"
          placeholder="Комментарий"
          class="textarea-field"
          rows="3"
        />
      </div>

      <!-- 6. История изменений -->
      <div class="history-section">
        <div class="history-table">
          <div class="table-header">
            <div class="table-col">Дата</div>
            <div class="table-col">Пользователь</div>
            <div class="table-col">Действие</div>
          </div>
          <div class="table-body">
            <div class="table-row" v-for="(record, index) in history" :key="index">
              <div class="table-col">{{ record.date }}</div>
              <div class="table-col">{{ record.user }}</div>
              <div class="table-col">{{ record.action }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Футер -->
    <template #footer>
      <button @click="handleCancel" class="btn btn-secondary">
        Отмена
      </button>
      <button
        @click="handleSave"
        class="btn btn-primary"
        :disabled="isSaving"
      >
        {{ isSaving ? 'Сохранение...' : 'Сохранить' }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  mode: {
    type: String,
    default: 'create',
    validator: (value) => ['create', 'reassign', 'edit'].includes(value)
  },
  initialData: {
    type: Object,
    default: () => ({})
  },
  qrCode: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['save', 'cancel'])

// Реактивные данные
const isLoading = ref(false)
const isSaving = ref(false)
const errorMessage = ref('')
const photos = ref([])
const history = ref([])

// Данные формы
const formData = ref({
  inv_number: '',
  buh_name: '',
  sklad: '',
  zavod: '',
  sn: '',
  comment: ''
})

// Данные местоположения
const place_ter = ref('')
const place_pos = ref('')
const place_cab = ref('')
const place_user = ref('')
const placeOptions = ref({
  ter: [],
  pos: [],
  cab: [],
  user: []
})

// Методы местоположения
const onTerChange = () => {
  place_pos.value = ''
  place_cab.value = ''
  place_user.value = ''
  console.log('Территория изменена:', place_ter.value)
}

const onPosChange = () => {
  place_cab.value = ''
  place_user.value = ''
  console.log('Помещение изменено:', place_pos.value)
}

const onCabChange = () => {
  place_user.value = ''
  console.log('Кабинет изменён:', place_cab.value)
}

const saveNewPlace = (level, parent, value) => {
  console.log(`Сохранение места: ${level}, родитель: ${parent}, значение: ${value}`)
}

// Методы действий
const addQrCode = () => {
  alert('Добавление QR-кода (функционал в разработке)')
}

const addPhoto = () => {
  alert('Добавление фото (функционал в разработке)')
}

// Основные методы
const handleSave = async () => {
  console.log('[ObjectFormModal] Сохранение...')
  isSaving.value = true
  
  const saveResult = {
    mode: props.mode,
    qrCode: props.qrCode,
    formData: formData.value,
    place_ter: place_ter.value,
    place_pos: place_pos.value,
    place_cab: place_cab.value,
    place_user: place_user.value,
    comment: formData.value.comment,
    photos: photos.value,
    initialData: props.initialData
  }
  
  console.log('Данные для сохранения:', saveResult)
  emit('save', saveResult)
  isSaving.value = false
}

const handleCancel = () => {
  console.log('[ObjectFormModal] Отмена')
  emit('cancel')
}

const handleClose = () => {
  console.log('[ObjectFormModal] Закрытие через BaseModal')
  emit('cancel')
}

// Загрузка данных при открытии
watch(() => props.isOpen, (isOpen) => {
  if (isOpen && props.initialData) {
    formData.value = {
      inv_number: props.initialData.inv_number || '',
      buh_name: props.initialData.buh_name || '',
      sklad: props.initialData.sklad || '',
      zavod: props.initialData.zavod || '',
      sn: props.initialData.sn || '',
      comment: props.initialData.comment || ''
    }
    
    place_ter.value = props.initialData.place_ter || ''
    place_pos.value = props.initialData.place_pos || ''
    place_cab.value = props.initialData.place_cab || ''
    place_user.value = props.initialData.place_user || ''
    
    placeOptions.value = {
      ter: ['Территория 1', 'Территория 2'],
      pos: ['Помещение 1', 'Помещение 2'],
      cab: ['Кабинет 101', 'Кабинет 102'],
      user: ['Иванов И.И.', 'Петров П.П.']
    }
    
    history.value = [
      { date: '2024-01-15 14:30', user: 'Иванов И.И.', action: 'Изменён серийный номер' },
      { date: '2024-01-10 09:15', user: 'Петров П.П.', action: 'Добавлен QR-код' }
    ]
  }
}, { immediate: true })
</script>

<style scoped>
@import './ObjectFormModal.css';
</style>