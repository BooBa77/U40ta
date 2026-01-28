import { ref } from 'vue'
import { objectService } from '@/components/ObjectForm/services/ObjectService'
import { qrService } from '@/components/QrScanner/services/qr.service'
import { statementService } from '../services/statement.service'
import { offlineCache } from '../../../services/OfflineCacheService'

export function useObjectFormManager(onSuccessCallback) {
  const showObjectForm = ref(false)
  const objectFormData = ref({
    mode: 'create',
    qrCode: '',
    initialData: {},
    existingObjectId: null,
    existingObjectData: null
  })
  
  // Открыть ObjectForm
  const openObjectForm = (params) => {
    // params содержит: mode, qrCode, rowData, existingObjectId, existingObjectData
    const initialDataForForm = params.rowData || {}
    
    objectFormData.value = {
      mode: params.mode || 'create',
      qrCode: params.qrCode || '',
      initialData: initialDataForForm,
      existingObjectId: params.existingObjectId,
      existingObjectData: params.existingObjectData
    }
    
    showObjectForm.value = true
  }
  
  // Закрыть ObjectForm
  const closeObjectForm = () => {
    showObjectForm.value = false
    // Не сбрасываем данные сразу, чтобы анимация закрытия была плавной
    setTimeout(() => {
      objectFormData.value = {
        mode: 'create',
        qrCode: '',
        initialData: {},
        existingObjectId: null,
        existingObjectData: null
      }
    }, 300)
  }
  
  // Обработчик сохранения (ГЛАВНЫЙ МЕТОД С ТРАНЗАКЦИЕЙ)
  const handleObjectFormSave = async (saveResult) => {
    console.log('[ObjectFormManager] Получены данные для сохранения:', saveResult)
    
    try {
      const { mode, qrCode, formData, existingQrCodes, newQrCodes } = saveResult
      const initialData = saveResult.initialData || {}
      
      // === ВАЛИДАЦИЯ КРИТИЧЕСКИХ ДАННЫХ ===
      if (!initialData.id) {
        throw new Error('Не найден ID записи ведомости')
      }
      
      if (!initialData.emailAttachmentId) {
        throw new Error('Не найден ID вложения email')
      }
      
      const statementId = initialData.id
      const attachmentId = initialData.emailAttachmentId
      
      console.log('[ObjectFormManager] Данные для обновления:', {
        statementId,
        attachmentId,
        mode,
        qrCodesCount: (qrCode ? 1 : 0) + newQrCodes.length
      })
      
      let result
      
      // === ВЫБОР РЕЖИМА ВЫПОЛНЕНИЯ ===
      if (objectService.isFlightMode()) {
        // ОФЛАЙН-РЕЖИМ: транзакция в IndexedDB
        console.log('[ObjectFormManager] Офлайн-режим: выполняем транзакцию')
        result = await executeOfflineTransaction(
          mode, qrCode, formData, existingQrCodes, newQrCodes, 
          statementId, attachmentId, initialData
        )
      } else {
        // ОНЛАЙН-РЕЖИМ: последовательные вызовы API
        console.log('[ObjectFormManager] Онлайн-режим: последовательные вызовы API')
        result = await executeOnlineOperations(
          mode, qrCode, formData, existingQrCodes, newQrCodes,
          statementId, attachmentId, initialData
        )
      }
      
      // === ЗАКРЫТИЕ МОДАЛКИ И КОЛБЭК ===
      closeObjectForm()
      
      if (onSuccessCallback && typeof onSuccessCallback === 'function') {
        console.log('[ObjectFormManager] Вызываем колбэк успеха')
        onSuccessCallback()
      }
      
      return {
        success: true,
        objectId: result.objectId,
        qrCodes: result.savedQrCodes,
        mode
      }
      
    } catch (error) {
      console.error('[ObjectFormManager] Ошибка сохранения:', error)
      
      // Пробрасываем ошибку для показа в UI
      throw new Error(`Ошибка сохранения: ${error.message}`)
    }
  }
  
  // === ОФЛАЙН-ТРАНЗАКЦИЯ (IndexedDB) ===
  const executeOfflineTransaction = async (
    mode, qrCode, formData, existingQrCodes, newQrCodes,
    statementId, attachmentId, initialData
  ) => {
    // Определяем, какие таблицы существуют
    const storeNames = []
    
    if (offlineCache.db.objects) storeNames.push('objects')
    if (offlineCache.db.qr_codes) storeNames.push('qr_codes')
    if (offlineCache.db.processed_statements) storeNames.push('processed_statements')
    
    if (storeNames.length === 0) {
      throw new Error('В IndexedDB нет необходимых таблиц')
    }
    
    console.log('[ObjectFormManager] Используем таблицы в транзакции:', storeNames)
    
    return offlineCache.db.transaction('rw', storeNames, async () => {
      console.log('[ObjectFormManager] Транзакция начата')
      
      let objectId
      const savedQrCodes = []
      
      // === 1. СОЗДАНИЕ ОБЪЕКТА ===
      if (mode === 'create' || mode === 'reassign') {
        const objectData = {
          inv_number: formData.inv_number,
          buh_name: formData.buh_name,
          sklad: formData.sklad,
          zavod: formData.zavod,
          party_number: formData.party_number || null,
          sn: formData.sn || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        // Генерируем ID (временное решение, пока нет сервера)
        objectId = Date.now() + Math.floor(Math.random() * 1000)
        objectData.id = objectId
        
        console.log('[ObjectFormManager] Создаём объект в транзакции:', objectData)
        
        // Проверяем, существует ли таблица objects
        if (!offlineCache.db.objects) {
          console.warn('[ObjectFormManager] Таблица objects не существует, создаём временно')
          // Создаём объект в памяти (пока нет БД)
          // В реальности нужно создать таблицу в IndexedDB
        } else {
          await offlineCache.db.objects.add(objectData)
        }
      } else if (mode === 'edit' && objectFormData.value.existingObjectId) {
        // Режим редактирования (пока не используется)
        objectId = objectFormData.value.existingObjectId
      }
      
      if (!objectId) {
        throw new Error('Не удалось получить ID объекта')
      }
      
      // === 2. ПРИВЯЗКА QR-КОДОВ (если таблица существует) ===
      const allQrCodes = [
        ...(qrCode ? [qrCode] : []),
        ...newQrCodes
      ]
      
      if (allQrCodes.length > 0 && offlineCache.db.qr_codes) {
        console.log('[ObjectFormManager] Привязываем QR-коды в транзакции:', allQrCodes)
        
        for (const qrValue of allQrCodes) {
          try {
            // Проверяем, существует ли QR в этой же транзакции
            const existingQr = await offlineCache.db.qr_codes
              .where('qr_value')
              .equals(qrValue)
              .first()
            
            if (existingQr) {
              // QR существует - перепривязываем
              existingQr.object_id = objectId
              existingQr.updated_at = new Date().toISOString()
              await offlineCache.db.qr_codes.put(existingQr)
              console.log(`[ObjectFormManager] QR перепривязан: ${qrValue} → объект ${objectId}`)
            } else {
              // QR не существует - создаём новый
              const newQr = {
                qr_value: qrValue,
                object_id: objectId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
              await offlineCache.db.qr_codes.add(newQr)
              console.log(`[ObjectFormManager] Новый QR создан: ${qrValue} → объект ${objectId}`)
            }
            
            savedQrCodes.push(qrValue)
            
          } catch (qrError) {
            console.error(`[ObjectFormManager] Ошибка привязки QR ${qrValue}:`, qrError)
            throw new Error(`Не удалось привязать QR-код ${qrValue}: ${qrError.message}`)
          }
        }
      } else {
        console.log('[ObjectFormManager] Нет QR-кодов для привязки или таблица qr_codes отсутствует')
      }
      
      // === 3. ОБНОВЛЕНИЕ ВЕДОМОСТИ (если таблица существует) ===
      if (offlineCache.db.processed_statements) {
        console.log('[ObjectFormManager] Обновляем ведомость в транзакции:', statementId)
        
        const statement = await offlineCache.db.processed_statements
          .where('id')
          .equals(statementId)
          .first()
        
        if (!statement) {
          throw new Error(`Запись ведомости ${statementId} не найдена`)
        }
        
        // Проверяем, что это правильная ведомость
        const stAttachmentId = statement.emailAttachmentId || statement.email_attachment_id
        if (Number(stAttachmentId) !== Number(attachmentId)) {
          throw new Error(`Запись ведомости ${statementId} принадлежит другому вложению`)
        }
        
        // Обновляем have_object
        statement.have_object = true
        statement.updated_at = new Date().toISOString()
        
        await offlineCache.db.processed_statements.put(statement)
        console.log('[ObjectFormManager] Ведомость обновлена')
      } else {
        console.warn('[ObjectFormManager] Таблица processed_statements не существует, пропускаем обновление')
      }
      
      console.log('[ObjectFormManager] Транзакция успешно завершена')
      return { objectId, savedQrCodes }
    }).catch(error => {
      console.error('[ObjectFormManager] Транзакция провалена:', error)
      throw error
    })
  }
  
  // === ОНЛАЙН-ОПЕРАЦИИ (API) ===
  const executeOnlineOperations = async (
    mode, qrCode, formData, existingQrCodes, newQrCodes,
    statementId, attachmentId, initialData
  ) => {
    let objectId
    const savedQrCodes = []
    
    // === 1. СОЗДАНИЕ ОБЪЕКТА ===
    if (mode === 'create' || mode === 'reassign') {
      const objectData = {
        inv_number: formData.inv_number,
        buh_name: formData.buh_name,
        sklad: formData.sklad,
        zavod: formData.zavod,
        party_number: formData.party_number || null,
        sn: formData.sn || null
      }
      
      console.log('[ObjectFormManager] Создаём объект через API:', objectData)
      
      // TODO: Реальный вызов API, когда будет готов
      // const newObject = await objectService.createObject(objectData)
      // objectId = newObject.id
      
      // Временная заглушка
      objectId = Date.now()
      console.log('[ObjectFormManager] Объект создан с ID (заглушка):', objectId)
    }
    
    // === 2. ПРИВЯЗКА QR-КОДОВ ===
    const allQrCodes = [
      ...(qrCode ? [qrCode] : []),
      ...newQrCodes
    ]
    
    console.log('[ObjectFormManager] Привязываем QR-коды через API:', allQrCodes)
    
    for (const qrValue of allQrCodes) {
      try {
        // Используем qrService для онлайн-проверки
        const qrWithObject = await qrService.getQrCodeWithObject(qrValue)
        
        if (qrWithObject && qrWithObject.qrRecord) {
          // QR существует - перепривязываем
          await qrService.updateQrCodeOwner(qrValue, objectId)
          console.log(`[ObjectFormManager] QR перепривязан через API: ${qrValue} → объект ${objectId}`)
        } else {
          // QR не существует - создаём новый
          await qrService.createQrCode(qrValue, objectId)
          console.log(`[ObjectFormManager] Новый QR создан через API: ${qrValue} → объект ${objectId}`)
        }
        
        savedQrCodes.push(qrValue)
        
      } catch (qrError) {
        console.error(`[ObjectFormManager] Ошибка привязки QR ${qrValue}:`, qrError)
        throw new Error(`Не удалось привязать QR-код: ${qrError.message}`)
      }
    }
    
    // === 3. ОБНОВЛЕНИЕ ВЕДОМОСТИ ===
    console.log('[ObjectFormManager] Обновляем ведомость через API:', { statementId, attachmentId })
    
    try {
      await statementService.updateStatementHaveObject(attachmentId, statementId, true)
    } catch (updateError) {
      console.error('[ObjectFormManager] Ошибка обновления ведомости:', updateError)
      
      // КРИТИЧНО: если не удалось обновить ведомость, нужно откатить всё
      // В идеале здесь должен быть компенсирующий транзакция
      // Пока просто пробрасываем ошибку
      throw new Error(`Объект создан, но не удалось обновить ведомость: ${updateError.message}`)
    }
    
    return { objectId, savedQrCodes }
  }
  
  // Обработчик отмены
  const handleObjectFormCancel = () => {
    console.log('[ObjectFormManager] Отмена')
    closeObjectForm()
  }
  
  return {
    showObjectForm,
    objectFormData,
    openObjectForm,
    handleObjectFormSave,
    handleObjectFormCancel
  }
}