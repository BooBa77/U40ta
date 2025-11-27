<template>
  <div class="object-form">
    <h2>Создание объекта</h2>
    
    <div class="readonly-fields">
      <div class="field">
        <label>Завод:</label>
        <span>{{ initialData?.zavod }}</span>
      </div>
      <div class="field">
        <label>Склад:</label>
        <span>{{ initialData?.sklad }}</span>
      </div>
      <div class="field">
        <label>Бух. наименование:</label>
        <span>{{ initialData?.buh_name }}</span>
      </div>
      <div class="field">
        <label>Инв. №:</label>
        <span>{{ initialData?.inv_number }}</span>
      </div>
      <div class="field">
        <label>Партия:</label>
        <span>{{ initialData?.party_number }}</span>
      </div>
    </div>
    <button @click="$router.back()">Назад</button>
  </div>
</template>

<script>
export default {
  props: {
    mode: String,
    initialData: Object
  }
}
</script>