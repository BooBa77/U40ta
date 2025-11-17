<template>
  <div class="home">
    <h2>📷 Умный сканер штрих-кодов</h2>
    
    <div class="upload-section">
      <input 
        type="file" 
        accept="image/*,.png,.jpg,.jpeg,.gif,.bmp,.webp" 
        @change="onFileSelected" 
        ref="fileInput"
        class="file-input"
      />
      <p class="file-hint">Выберите изображение со штрих-кодом или QR-кодом</p>
    </div>

    <div v-if="isLoading" class="loading">
      <div class="spinner">⏳</div>
      <p>Сканируем изображение...</p>
    </div>

    <div v-if="scanResult" class="result success">
      <h3>✅ Успешно распознано!</h3>
      <div class="result-content">
        <p><strong>Текст:</strong> <code>{{ scanResult.text }}</code></p>
        <p><strong>Формат:</strong> {{ formatNames[scanResult.format] || scanResult.format }}</p>
        <p><strong>Метод:</strong> {{ scanResult.method }}</p>
      </div>
      <button @click="copyToClipboard" class="copy-btn">📋 Копировать</button>
    </div>

    <div v-if="errorMessage" class="result error">
      <h3>❌ Не удалось распознать</h3>
      <p>{{ errorMessage }}</p>
      <div class="tips">
        <h4>Советы для лучшего распознавания:</h4>
        <ul>
          <li>✅ Четкое изображение без размытия</li>
          <li>✅ Прямой угол съемки</li>
          <li>✅ Хорошее освещение</li>
          <li>✅ Минимальные искажения</li>
          <li>✅ Штрих-код должен занимать значительную часть изображения</li>
        </ul>
      </div>
    </div>

    <div class="stats">
      <h4>Статистика распознавания:</h4>
      <p>QR-коды: {{ stats.qr }} | Штрих-коды: {{ stats.barcode }} | Не распознано: {{ stats.failed }}</p>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';

// Карта форматов для понятных названий
const formatNames = {
  '0': 'AZTEC',
  '1': 'CODABAR', 
  '2': 'CODE_39',
  '3': 'CODE_93',
  '4': 'CODE_128',
  '5': 'DATA_MATRIX',
  '6': 'EAN_8',
  '7': 'EAN_13',
  '8': 'ITF',
  '9': 'MAXICODE',
  '10': 'PDF_417',
  '11': 'QR_CODE',
  '12': 'RSS_14',
  '13': 'RSS_EXPANDED',
  '14': 'UPC_A',
  '15': 'UPC_E',
  '16': 'UPC_EAN_EXTENSION'
};

export default {
  name: 'Home',
  setup() {
    const fileInput = ref(null);
    const scanResult = ref(null);
    const isLoading = ref(false);
    const errorMessage = ref('');
    const stats = ref({ qr: 0, barcode: 0, failed: 0 });

    // Основной метод с ZXing
    const tryZXing = async (file) => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/library');
        
        const imageUrl = URL.createObjectURL(file);
        const reader = new BrowserMultiFormatReader();
        
        const result = await reader.decodeFromImageUrl(imageUrl);
        URL.revokeObjectURL(imageUrl);
        
        if (result) {
          const format = result.getBarcodeFormat().toString();
          // Считаем статистику
          if (format === 'QR_CODE') {
            stats.value.qr++;
          } else {
            stats.value.barcode++;
          }
          
          return {
            success: true,
            text: result.getText(),
            format: format,
            method: 'ZXing'
          };
        }
        
        return { success: false, error: 'ZXing не нашел код' };
      } catch (error) {
        return { success: false, error: `ZXing: ${error.message}` };
      }
    };

    // Метод с jsQR для QR-кодов
    const tryJsQR = async (file) => {
      try {
        const { default: jsQR } = await import('jsqr');
        
        const imageUrl = URL.createObjectURL(file);
        const img = new Image();
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imageUrl;
        });
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        URL.revokeObjectURL(imageUrl);
        
        if (code) {
          stats.value.qr++;
          return {
            success: true,
            text: code.data,
            format: 'QR_CODE',
            method: 'jsQR'
          };
        }
        
        return { success: false, error: 'jsQR не нашел QR-код' };
      } catch (error) {
        return { success: false, error: `jsQR: ${error.message}` };
      }
    };

    // Современный BarcodeDetector API
    const tryBarcodeDetector = async (file) => {
      try {
        if (!('BarcodeDetector' in window)) {
          return { success: false, error: 'BarcodeDetector не поддерживается' };
        }
        
        // Получаем список поддерживаемых форматов
        const formats = await BarcodeDetector.getSupportedFormats();
        console.log('Поддерживаемые форматы:', formats);
        
        const imageUrl = URL.createObjectURL(file);
        const img = new Image();
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imageUrl;
        });
        
        const barcodeDetector = new BarcodeDetector({
          formats: formats.includes('qr_code') ? formats : ['qr_code', 'code_128', 'ean_13', 'upc_a']
        });
        
        const barcodes = await barcodeDetector.detect(img);
        URL.revokeObjectURL(imageUrl);
        
        if (barcodes.length > 0) {
          const barcode = barcodes[0];
          if (barcode.format === 'qr_code') {
            stats.value.qr++;
          } else {
            stats.value.barcode++;
          }
          
          return {
            success: true,
            text: barcode.rawValue,
            format: barcode.format.toUpperCase(),
            method: 'BarcodeDetector'
          };
        }
        
        return { success: false, error: 'BarcodeDetector не нашел код' };
      } catch (error) {
        return { success: false, error: `BarcodeDetector: ${error.message}` };
      }
    };

    // Подготовка изображения для улучшения распознавания
    const enhanceImage = (file) => {
      return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Увеличиваем контраст и резкость
          canvas.width = img.width;
          canvas.height = img.height;
          
          ctx.drawImage(img, 0, 0);
          
          // Применяем фильтры для улучшения
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Простое увеличение контраста
          for (let i = 0; i < data.length; i += 4) {
            const contrast = 1.5;
            data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128));
            data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128));
            data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128));
          }
          
          ctx.putImageData(imageData, 0, 0);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/png'));
        };
        
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };
        
        img.src = url;
      });
    };

    const onFileSelected = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      console.log(`🖼️ Файл выбран: ${file.name} ${file.type}`);
      
      // Сброс состояния
      isLoading.value = true;
      scanResult.value = null;
      errorMessage.value = '';

      try {
        let result;

        // Пробуем разные методы в порядке эффективности
        console.log('1. Пробуем BarcodeDetector API...');
        result = await tryBarcodeDetector(file);
        
        if (!result.success) {
          console.log('2. Пробуем ZXing...');
          result = await tryZXing(file);
        }
        
        if (!result.success) {
          console.log('3. Пробуем jsQR...');
          result = await tryJsQR(file);
        }
        
        // Если все еще не нашли, пробуем с улучшенным изображением
        if (!result.success) {
          console.log('4. Пробуем с улучшенным изображением...');
          const enhancedUrl = await enhanceImage(file);
          if (enhancedUrl) {
            // Создаем файл из улучшенного изображения
            const response = await fetch(enhancedUrl);
            const blob = await response.blob();
            const enhancedFile = new File([blob], file.name, { type: 'image/png' });
            
            // Пробуем снова с улучшенным изображением
            result = await tryBarcodeDetector(enhancedFile);
            if (!result.success) {
              result = await tryZXing(enhancedFile);
            }
          }
        }

        if (result.success) {
          scanResult.value = result;
          console.log('✅ Успех:', result);
        } else {
          stats.value.failed++;
          errorMessage.value = `Не удалось распознать код.\n\nПопробуйте:\n• Более четкое изображение\n• Прямой угол съемки\n• Хорошее освещение\n• Кадрируйте только штрих-код`;
          console.log('❌ Все методы не сработали');
        }

      } catch (error) {
        stats.value.failed++;
        console.error('💥 Критическая ошибка:', error);
        errorMessage.value = 'Произошла непредвиденная ошибка: ' + error.message;
      } finally {
        isLoading.value = false;
        if (fileInput.value) {
          fileInput.value.value = '';
        }
      }
    };

    const copyToClipboard = async () => {
      if (scanResult.value) {
        try {
          await navigator.clipboard.writeText(scanResult.value.text);
          alert('Текст скопирован в буфер обмена!');
        } catch (err) {
          console.error('Ошибка копирования:', err);
        }
      }
    };

    onMounted(() => {
      console.log('📷 Умный сканер штрих-кодов инициализирован');
      
      // Проверяем поддержку BarcodeDetector
      if ('BarcodeDetector' in window) {
        console.log('✅ BarcodeDetector API поддерживается');
      } else {
        console.log('❌ BarcodeDetector API не поддерживается');
      }
    });

    return {
      fileInput,
      scanResult,
      isLoading,
      errorMessage,
      stats,
      formatNames,
      onFileSelected,
      copyToClipboard
    };
  }
}
</script>

<style scoped>
.home {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.upload-section {
  margin: 30px 0;
  text-align: center;
}

.file-input {
  margin: 10px 0;
  padding: 15px;
  border: 2px dashed #42b983;
  border-radius: 12px;
  width: 100%;
  background: #f9f9f9;
  cursor: pointer;
  transition: all 0.3s ease;
}

.file-input:hover {
  border-color: #2c3e50;
  background: #f0f0f0;
}

.file-hint {
  font-size: 14px;
  color: #666;
  margin-top: 5px;
}

.loading {
  margin: 20px 0;
  padding: 20px;
  background: #fff3cd;
  border-radius: 8px;
  border-left: 4px solid #ffc107;
  text-align: center;
}

.spinner {
  font-size: 24px;
  margin-bottom: 10px;
}

.result {
  margin: 20px 0;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid;
}

.result.success {
  background: #e8f5e8;
  border-color: #42b983;
}

.result.error {
  background: #ffeaea;
  border-color: #e74c3c;
  white-space: pre-line;
}

.result-content {
  margin: 15px 0;
}

.result-content code {
  background: #fff;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #ddd;
  font-family: monospace;
  display: inline-block;
  word-break: break-all;
  max-width: 100%;
}

.copy-btn {
  background: #42b983;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
}

.copy-btn:hover {
  background: #3aa876;
}

.tips {
  margin-top: 15px;
  padding: 15px;
  background: #fff;
  border-radius: 6px;
}

.tips h4 {
  margin-top: 0;
  color: #2c3e50;
}

.tips ul {
  margin: 10px 0;
  padding-left: 20px;
}

.tips li {
  margin: 5px 0;
}

.stats {
  margin-top: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  font-size: 14px;
}

.stats h4 {
  margin-top: 0;
  margin-bottom: 8px;
}
</style>