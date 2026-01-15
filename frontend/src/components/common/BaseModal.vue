<!-- BaseModal.vue -->
<template>
  <Transition name="modal">
    <div class="modal-overlay" v-if="isOpen" @click.self="handleOverlayClick">
      <div class="modal-container" :style="containerStyle">
        <div class="modal-header" v-if="showHeader">
          <h3 class="modal-title">{{ title }}</h3>
          <button 
            v-if="showCloseButton" 
            class="modal-close" 
            @click="emitClose"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        
        <div class="modal-content">
          <slot></slot>
        </div>
        
        <div class="modal-footer" v-if="hasFooterSlot">
          <slot name="footer"></slot>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed, useSlots } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  title: {
    type: String,
    default: ''
  },
  showHeader: {
    type: Boolean,
    default: true
  },
  showCloseButton: {
    type: Boolean,
    default: true
  },
  width: {
    type: String,
    default: '500px'
  },
  maxWidth: {
    type: String,
    default: '90vw'
  },
  maxHeight: {
    type: String,
    default: '85vh'
  },
  closeOnOverlayClick: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['close'])

const slots = useSlots()
const hasFooterSlot = computed(() => !!slots.footer)

const containerStyle = computed(() => ({
  width: props.width,
  maxWidth: props.maxWidth,
  maxHeight: props.maxHeight
}))

const handleOverlayClick = () => {
  if (props.closeOnOverlayClick) {
    emitClose()
  }
}

const emitClose = () => {
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.modal-container {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideIn 0.3s ease;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e9ecef;
  background-color: #f8f9fa;
  flex-shrink: 0;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.modal-close:hover {
  background-color: #e9ecef;
  color: #333;
}

.modal-content {
  padding: 24px;
  overflow-y: auto;
  flex-grow: 1;
}

.modal-footer {
  padding: 20px 24px;
  border-top: 1px solid #e9ecef;
  background-color: #f8f9fa;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
}

/* Анимации */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: translateY(-20px);
  opacity: 0;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Адаптивность */
@media (max-width: 768px) {
  .modal-container {
    width: 95% !important;
    max-width: 95vw !important;
    margin: 10px;
  }
  
  .modal-header,
  .modal-content,
  .modal-footer {
    padding: 16px;
  }
  
  .modal-title {
    font-size: 1.1rem;
  }
}
</style>