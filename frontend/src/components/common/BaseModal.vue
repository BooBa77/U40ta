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
/* ============================================================================
   БАЗОВЫЕ ПЕРЕМЕННЫЕ
   ========================================================================== */
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
}

.modal-container {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 20px 35px -8px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ============================================================================
   ХЕДЕР
   ========================================================================== */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eef2f6;
  background-color: #ffffff;
  flex-shrink: 0;
}

.modal-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1f36;
}

.modal-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  color: #8a8f9e;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background-color: #f1f3f5;
  color: #1a1f36;
}

/* ============================================================================
   КОНТЕНТ — базовые шрифты
   ========================================================================== */
.modal-content {
  overflow-y: auto;
  flex-grow: 1;
  padding: 20px;
  font-size: 14px;
  color: #1f2937;
  line-height: 1.4;
}

/* ============================================================================
   ФУТЕР
   ========================================================================== */
.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid #eef2f6;
  background-color: #fafbfc;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

/* ============================================================================
   ЕДИНЫЕ КНОПКИ ДЛЯ ВСЕХ МОДАЛОК
   ========================================================================== */
.modal-btn {
  padding: 8px 16px;
  min-width: 72px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-family: inherit;
  line-height: 1.2;
}

/* Primary — основное действие */
.modal-btn-primary {
  background-color: #3b82f6;
  color: white;
}

.modal-btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.modal-btn-primary:active:not(:disabled) {
  transform: scale(0.98);
}

/* Secondary — второстепенное действие */
.modal-btn-secondary {
  background-color: #6b7280;
  color: white;
}

.modal-btn-secondary:hover:not(:disabled) {
  background-color: #4b5563;
}

.modal-btn-secondary:active:not(:disabled) {
  transform: scale(0.98);
}

/* Outline — отмена / сброс */
.modal-btn-outline {
  background-color: transparent;
  color: #6b7280;
  border: 1px solid #d1d5db;
}

.modal-btn-outline:hover:not(:disabled) {
  background-color: #f3f4f6;
  border-color: #9ca3af;
}

.modal-btn-outline:active:not(:disabled) {
  transform: scale(0.98);
}

/* Disabled для всех кнопок */
.modal-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* ============================================================================
   АНИМАЦИИ
   ========================================================================== */
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

/* ============================================================================
   СКРОЛЛБАР ДЛЯ CONTENT
   ========================================================================== */
.modal-content::-webkit-scrollbar {
  width: 4px;
}

.modal-content::-webkit-scrollbar-track {
  background: #f1f3f5;
  border-radius: 4px;
}

.modal-content::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.modal-content::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* ============================================================================
   МОБИЛЬНАЯ АДАПТАЦИЯ (компактно)
   ========================================================================== */
@media (max-width: 768px) {
  .modal-header {
    padding: 12px 16px;
  }
  
  .modal-title {
    font-size: 1rem;
  }
  
  .modal-content {
    padding: 16px;
  }
  
  .modal-footer {
    padding: 10px 16px;
    gap: 8px;
  }
  
  .modal-btn {
    padding: 6px 14px;
    min-width: 64px;
    font-size: 13px;
  }
  
  .modal-close {
    width: 28px;
    height: 28px;
    font-size: 22px;
  }
}

@media (max-width: 480px) {
  .modal-content {
    padding: 12px;
  }
  
  .modal-footer {
    flex-direction: column-reverse;
  }
  
  .modal-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>