<!-- Modal.vue -->
<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal" @keyup.enter="applyFilter">
      <div class="modal-header">
        <h2>Фильтр: {{ title }}</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <div class="modal-body">
        <slot>
          <p>{{ content }}</p>
          
          <div class="filter-input-section">
            <label for="filter-input">Значение для фильтрации:</label>
            <input
              id="filter-input"
              type="text"
              v-model="filterValue"
              placeholder="Введите текст для фильтрации..."
              autofocus
              @keyup.enter="applyFilter"
            />
            <div class="filter-examples">
              <p><strong>Примеры:</strong></p>
              <ul>
                <li v-if="title === 'Страна'">
                  <code>"а"</code> - страны, содержащие букву "а"
                </li>
                <li v-if="title === 'Страна'">
                  <code>"ар"</code> - страны, содержащие "ар" (Аргентина, Алжир)
                </li>
                <li v-if="title === 'Столица'">
                  <code>"н"</code> - столицы, содержащие букву "н"
                </li>
                <li v-if="title === 'Столица'">
                  <code>"рим"</code> - столица "Рим"
                </li>
              </ul>
            </div>
          </div>
        </slot>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" @click="resetFilter">
          Сбросить фильтр
        </button>
        <button class="btn-primary" @click="applyFilter">
          Применить фильтр
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  content: {
    type: String,
    default: ''
  },
  filterValue: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close', 'apply-filter', 'reset-filter']);

const filterValue = ref(props.filterValue);

const applyFilter = () => {
  emit('apply-filter', filterValue.value);
};

const resetFilter = () => {
  filterValue.value = '';
  emit('reset-filter');
};

onMounted(() => {
  const input = document.getElementById('filter-input');
  if (input) {
    input.focus();
    input.select();
  }
});
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
  animation: fadeIn 0.3s ease;
}

.modal {
  background-color: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
  background-color: #f8f9fa;
}

.modal-header h2 {
  margin: 0;
  color: #333;
  font-size: 1.4rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background-color: #e9ecef;
  color: #333;
}

.modal-body {
  padding: 25px;
  color: #555;
}

.modal-body p {
  margin-bottom: 20px;
  line-height: 1.6;
  color: #666;
}

.filter-input-section {
  margin-top: 20px;
}

.filter-input-section label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
}

.filter-input-section input {
  width: 100%;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 16px;
  transition: border-color 0.3s;
  box-sizing: border-box;
}

.filter-input-section input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
}

.filter-examples {
  margin-top: 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #6c757d;
}

.filter-examples p {
  margin-bottom: 10px;
  color: #495057;
}

.filter-examples ul {
  margin: 0;
  padding-left: 20px;
}

.filter-examples li {
  margin-bottom: 8px;
  color: #6c757d;
}

.filter-examples code {
  background-color: #e9ecef;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  color: #d63384;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  min-width: 120px;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover {
  background-color: #0056b3;
  transform: translateY(-1px);
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background-color: #545b62;
  transform: translateY(-1px);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 600px) {
  .modal {
    width: 95%;
    margin: 10px;
  }
  
  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 15px;
  }
  
  .modal-footer {
    flex-direction: column;
  }
  
  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}
</style>