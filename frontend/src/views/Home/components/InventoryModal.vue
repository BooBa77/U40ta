<template>
  <BaseModal
    :is-open="isOpen"
    title="Новая инвентаризация"
    @close="$emit('close')"
  >
    <div class="new-inventory-placeholder">
      Выбор инвентаризационных ведомостей будет доступен позже
    </div>
    
    <template #footer>
      <button class="back-button" @click="$emit('close')">
        Назад
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import BaseModal from '@/components/common/BaseModal.vue'

defineProps({
  isOpen: {
    type: Boolean,
    required: true
  }
})

defineEmits(['close'])
</script>

<style scoped>
.new-inventory-placeholder {
  padding: 2rem 1.5rem;
  text-align: center;
  color: #666;
  font-style: italic;
  font-size: 0.95rem;
}

.back-button {
  padding: 0.6rem 1.5rem;
  background-color: #ffffff;
  border: 1px solid #000000;
  color: #000000;
  font-family: monospace;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 120px;
}

.back-button:hover {
  background-color: #000000;
  color: #ffffff;
}
</style>