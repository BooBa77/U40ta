// modalUtils.js
import { ref } from 'vue';

export const useModal = () => {
  const isModalOpen = ref(false);
  const modalTitle = ref('');
  const modalContent = ref('');
  const modalColumnId = ref('');
  const modalFilterValue = ref('');
  const onFilterApply = ref(null);
  
  const openModal = (title, content, columnId, currentFilter, callback) => {
    modalTitle.value = title;
    modalContent.value = content;
    modalColumnId.value = columnId;
    modalFilterValue.value = currentFilter || '';
    onFilterApply.value = callback;
    isModalOpen.value = true;
  };
  
  const closeModal = () => {
    isModalOpen.value = false;
    modalTitle.value = '';
    modalContent.value = '';
    modalColumnId.value = '';
    modalFilterValue.value = '';
    onFilterApply.value = null;
  };
  
  const applyFilter = () => {
    if (onFilterApply.value) {
      onFilterApply.value(modalColumnId.value, modalFilterValue.value);
    }
    closeModal();
  };
  
  const resetFilter = () => {
    modalFilterValue.value = '';
    if (onFilterApply.value) {
      onFilterApply.value(modalColumnId.value, '');
    }
    closeModal();
  };
  
  return {
    isModalOpen,
    modalTitle,
    modalContent,
    modalColumnId,
    modalFilterValue,
    openModal,
    closeModal,
    applyFilter,
    resetFilter
  };
};