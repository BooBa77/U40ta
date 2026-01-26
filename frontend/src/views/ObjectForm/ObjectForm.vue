<template>
  <div class="object-form">
    <!-- Шапка -->
    <div class="header">
      <button class="btn-back" @click="goBack">←</button>
      <h1>Карточка объекта учёта склада {{ sklad }}</h1>
    </div>

    <!-- Индикатор загрузки -->
    <div v-if="isLoading" class="loading">Загрузка...</div>

    <!-- Сообщение об ошибке -->
    <div v-if="error" class="error">{{ error }}</div>

    <!-- Основная форма -->
    <div v-if="!isLoading && !error" class="form-body">
      <!-- Инвентарный номер + партия -->
      <div class="field">
        <label>Инвентарный номер</label>
        <div class="static-field">
          {{ invNumberDisplay }}
        </div>
      </div>

      <!-- Бухгалтерское наименование -->
      <div class="field">
        <label>Наименование</label>
        <div class="static-field">
          {{ buh_name }}
        </div>
      </div>

      <!-- Серийный номер -->
      <div class="field">
        <label>Серийный номер</label>
        <input
          type="text"
          v-model="sn"
          placeholder="Введите серийный номер"
        />
      </div>

      <!-- Дата проверки -->
      <div class="field">
        <label>Дата проверки</label>
        <input
          type="date"
          v-model="checked_at"
        />
      </div>

      <!-- Место использования -->
      <div class="place-section">
        <h3>Место использования</h3>

        <!-- Территория -->
        <div class="field">
          <label>Территория</label>
          <input
            type="text"
            v-model="place_ter"
            list="ter-list"
            placeholder="Выберите или введите территорию"
            @change="onTerChange"
            @blur="saveNewPlace('ter', null, place_ter)"
          />
          <datalist id="ter-list">
            <option v-for="ter in placeOptions.ter" :key="ter" :value="ter" />
          </datalist>
        </div>

        <!-- Помещение -->
        <div class="field" :class="{ disabled: !place_ter }">
          <label>Помещение</label>
          <input
            type="text"
            v-model="place_pos"
            list="pos-list"
            :disabled="!place_ter"
            placeholder="Выберите или введите помещение"
            @change="onPosChange"
            @blur="saveNewPlace('pos', place_ter, place_pos)"
          />
          <datalist id="pos-list">
            <option v-for="pos in placeOptions.pos" :key="pos" :value="pos" />
          </datalist>
        </div>

        <!-- Кабинет -->
        <div class="field" :class="{ disabled: !place_pos }">
          <label>Кабинет</label>
          <input
            type="text"
            v-model="place_cab"
            list="cab-list"
            :disabled="!place_pos"
            placeholder="Выберите или введите кабинет"
            @change="onCabChange"
            @blur="saveNewPlace('cab', place_pos, place_cab)"
          />
          <datalist id="cab-list">
            <option v-for="cab in placeOptions.cab" :key="cab" :value="cab" />
          </datalist>
        </div>

        <!-- Пользователь -->
        <div class="field" :class="{ disabled: !place_cab }">
          <label>Пользователь</label>
          <input
            type="text"
            v-model="place_user"
            list="user-list"
            :disabled="!place_cab"
            placeholder="Выберите или введите пользователя"
            @blur="saveNewPlace('user', place_cab, place_user)"
          />
          <datalist id="user-list">
            <option v-for="user in placeOptions.user" :key="user" :value="user" />
          </datalist>
        </div>
      </div>

      <!-- Кнопка сохранения -->
      <div class="actions">
        <button 
          class="btn-save" 
          @click="saveObject"
          :disabled="isSaving"
        >
          {{ isSaving ? 'Сохранение...' : 'Сохранить' }}
        </button>
        
        <!-- Сообщение об успешном сохранении -->
        <div v-if="saveSuccess" class="success-message">
          ✓ Данные сохранены
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useObjectForm } from './ObjectForm.js'

const route = useRoute()
const router = useRouter()

const {
  isLoading,
  error,
  isSaving,
  saveSuccess,
  sklad,
  inv_number,
  party_number,
  buh_name,
  sn,
  checked_at,
  place_ter,
  place_pos,
  place_cab,
  place_user,
  placeOptions,
  onTerChange,
  onPosChange,
  onCabChange,
  saveNewPlace,
  saveObject,
  goBack,
  loadObject
} = useObjectForm(route, router)

const invNumberDisplay = computed(() => {
  if (inv_number.value && party_number.value) {
    return `${inv_number.value} / ${party_number.value}`
  }
  return inv_number.value || '—'
})

onMounted(() => {
  loadObject()
})
</script>

<style scoped src="./ObjectForm.css"></style>