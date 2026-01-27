import { ref } from 'vue'

export function useObjectFormManager(reload) {
  // Состояние ObjectForm
  const showObjectForm = ref(false)
  const objectFormData = ref({
    mode: 'create',
    initialData: {},
    qrCode: ''
  })

  /**
   * Открывает модалку ObjectForm
   */
  const openObjectForm = (params) => {
    objectFormData.value = {
      mode: params.mode || 'create',
      qrCode: params.qrCode || '',
      initialData: {
        inv_number: params.rowData.inv_number || params.rowData.invNumber || '',
        buh_name: params.rowData.buh_name || params.rowData.buhName || '',
        party_number: params.rowData.party_number || params.rowData.partyNumber || '',
        sklad: params.rowData.sklad || '',
        zavod: params.rowData.zavod || '',
        sn: params.rowData.sn || ''
      }
    }
    showObjectForm.value = true
  }

  /**
   * Обработчик сохранения ObjectForm
   */
  const handleObjectFormSave = (result) => {
    console.log('ObjectForm сохранён:', result)
    showObjectForm.value = false
    
    // Обновляем ведомость
    if (reload && typeof reload === 'function') {
      reload()
    }
  }

  /**
   * Обработчик отмены ObjectForm
   */
  const handleObjectFormCancel = () => {
    console.log('ObjectForm отменён')
    showObjectForm.value = false
  }

  return {
    // Состояние
    showObjectForm,
    objectFormData,
    
    // Методы
    openObjectForm,
    handleObjectFormSave,
    handleObjectFormCancel
  }
}