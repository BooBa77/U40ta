<template>
  <div class="home">
    <!-- Верхний правый угол - Exit -->
    <div class="header-actions">
      <ExitButton />
    </div>

    <!-- Основной контент по центру -->
    <div class="main-content">
      <div class="user-abr" v-if="userAbr">{{ userAbr }}</div>
      
      <input 
        type="file" 
        accept="image/*" 
        @change="onFileSelected" 
        style="display: none" 
        ref="fileInput"
      >
      <BaseButton 
        class="scan-btn" 
        @click="triggerFileInput"
        size="large"
      >
        📷 Сканировать штрих-код
      </BaseButton>
    </div>

    <!-- Нижний блок - PWA -->
    <div class="pwa-section">
      <PWAInstallButton />
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import BaseButton from '@/components/ui/BaseButton.vue'
import ExitButton from '@/components/ui/ExitButton.vue'
import PWAInstallButton from '@/components/ui/PWAInstallButton.vue'

export default {
  name: 'Home',
  setup() {
    const router = useRouter();
    const fileInput = ref(null);
    
    const userData = ref({ sub: null, role: null });
    const userAbr = ref('');
    const showInstallBtn = ref(false);
    const deferredPrompt = ref(null);
    const scannedCode = ref(null);
    const loading = ref(false);
    const loadingMessage = ref('');
    const debugInfo = ref('');
    const successCount = ref(0);
    const failCount = ref(0);
    
    let html5QrcodeInstance = null;

    const checkAuth = () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        router.push('/login');
        return;
      }
      
      try {
        const payloadBase64 = token.split('.')[1];
        const payloadJson = atob(payloadBase64);
        const payload = JSON.parse(payloadJson);
        
        userData.value = {
          sub: payload.sub,
          role: payload.role
        };
        
      } catch (error) {
        console.error('Ошибка декодирования токена:', error);
        router.push('/login');
      }
    };

    const loadUserAbr = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const userId = userData.value.sub;
        
        const response = await fetch(`/api/users/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const user = await response.json();
          userAbr.value = user.abr;
        }
      } catch (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
      }
    };

    const triggerFileInput = () => {
      fileInput.value.click();
    };

    const loadHtml5QrcodeScript = () => {
      return new Promise((resolve, reject) => {
        if (window.Html5Qrcode) {
          resolve(window.Html5Qrcode);
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
        script.onload = () => {
          if (window.Html5Qrcode) {
            resolve(window.Html5Qrcode);
          } else {
            reject(new Error('Html5Qrcode не загрузился'));
          }
        };
        script.onerror = () => {
          reject(new Error('CDN не доступен'));
        };
        document.head.appendChild(script);
      });
    };

    const scanWithHtml5Qrcode = async (file) => {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = window;

      if (html5QrcodeInstance) {
          try {
              await html5QrcodeInstance.clear();
              console.log("Previous Html5Qrcode instance cleared.");
          } catch (e) {
              console.warn("Error clearing previous Html5Qrcode instance:", e);
          }
      }

      // Используйте 'reader-element' как ID, если он есть в вашем шаблоне,
      // или любой другой существующий элемент, который Html5Qrcode может использовать.
      // Для scanFile, он может быть не так критичен, но лучше его указать.
      html5QrcodeInstance = new Html5Qrcode("reader-element"); 
      
      // --- Определим все форматы, которые мы хотим поддерживать ---
      const allSupportedFormats = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8, 
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.QR_CODE // Добавьте QR, если хотите его сканировать тоже
      ];
      // ---------------------------------------------------------

      console.log('🔍 Начинаем сканирование с указанными форматами');

      try {
          // --- Главное изменение: передаем 'formats' вместо 'formatsToSupport' ---
          const result = await html5QrcodeInstance.scanFile(file, false, {
            formats: allSupportedFormats // Используем ключ 'formats'
          });
          // --------------------------------------------------------------------
          console.log(`✅ Успех с форматами:`, allSupportedFormats);
          return { code: result, formatGroup: 'All Scanned' }; // Помечаем, что сканировали всё
      } catch (error) {
          console.log(`❌ Сканирование не удалось:`, error.message);
          // Продолжаем бросать ошибку, чтобы onFileSelected мог её поймать
          throw error; 
      }
    };
    const onFileSelected = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      console.log('🖼️ Файл:', file.name, file.type, file.size);
      
      loading.value = true;
      scannedCode.value = null;
      debugInfo.value = '';

      try {
        loadingMessage.value = 'Загружаем сканер...';
        await loadHtml5QrcodeScript();
        
        loadingMessage.value = 'Сканируем с разными форматами...';
        const result = await scanWithHtml5Qrcode(file);
        
        scannedCode.value = result.code;
        debugInfo.value = `✅ Успех!\nКод: ${result.code}\nГруппа форматов: ${result.formatGroup}\nФайл: ${file.name}`;
        successCount.value++;
        
        console.log('✅ Найден код:', result.code, 'Группа:', result.formatGroup);
        
      } catch (error) {
        console.log('❌ Все группы не сработали:', error);
        failCount.value++;
        
        debugInfo.value = `❌ Не удалось распознать\nФайл: ${file.name}\nПричина: ${error.message}\n\nСтатистика: ${successCount.value} успешно, ${failCount.value} не распознано\n\nВероятно это неподдерживаемый формат штрих-кода`;
      } finally {
        loading.value = false;
        loadingMessage.value = '';
        event.target.value = '';
      }
    };

    const initPWA = () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
          .then(() => {
            console.log('Service Worker registered');
          })
          .catch((error) => {
            console.error('Service Worker registration failed:', error);
          });
      }

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt.value = e;
        showInstallBtn.value = true;
      });

      window.addEventListener('appinstalled', () => {
        showInstallBtn.value = false;
      });
    };

    const installPWA = () => {
      if (deferredPrompt.value) {
        deferredPrompt.value.prompt();
        deferredPrompt.value.userChoice.then((choiceResult) => {
          deferredPrompt.value = null;
        });
      }
    };

    const logout = () => {
      localStorage.removeItem('auth_token');
      router.push('/login');
    };

    onMounted(() => {
      checkAuth();
      loadUserAbr();
      initPWA();
    });

    return {
      userData,
      userAbr,
      showInstallBtn,
      scannedCode,
      loading,
      loadingMessage,
      debugInfo,
      successCount,
      failCount,
      fileInput,
      triggerFileInput,
      onFileSelected,
      installPWA,
      logout
    };
  }
}
</script>

<style scoped>
.home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  position: relative;
}

.user-abr {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.2);
  padding: 10px 15px;
  border-radius: 20px;
  font-weight: bold;
  backdrop-filter: blur(10px);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
}

.scan-btn {
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  border: none;
  padding: 15px 25px;
  font-size: 1.1rem;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  margin: 20px 0;
}

.scan-btn:hover {
  background: white;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

.scan-stats {
  background: rgba(255, 255, 255, 0.2);
  padding: 15px;
  border-radius: 10px;
  margin: 10px 0;
  backdrop-filter: blur(10px);
  font-size: 0.9rem;
  text-align: center;
}

.scan-stats div {
  margin: 5px 0;
}

.scan-result {
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  padding: 15px 25px;
  border-radius: 10px;
  margin: 20px 0;
  font-size: 1.1rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.loading {
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  padding: 10px 20px;
  border-radius: 10px;
  margin: 10px 0;
  font-size: 1rem;
}

.debug-info {
  background: rgba(0, 0, 0, 0.3);
  padding: 15px;
  border-radius: 10px;
  margin: 10px 0;
  font-size: 0.9rem;
  text-align: left;
  max-width: 100%;
  overflow-x: auto;
}

.debug-info pre {
  margin: 0;
  white-space: pre-wrap;
}

.format-info {
  background: rgba(255, 255, 255, 0.1);
  padding: 15px;
  border-radius: 10px;
  margin: 10px 0;
  backdrop-filter: blur(10px);
}

.format-info h4 {
  margin: 0 0 10px 0;
  text-align: center;
}

.format-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.format-item {
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  text-align: center;
}

.format-item.supported {
  background: rgba(76, 175, 80, 0.3);
  border: 1px solid rgba(76, 175, 80, 0.5);
}

.format-item.problematic {
  background: rgba(255, 152, 0, 0.3);
  border: 1px solid rgba(255, 152, 0, 0.5);
}

.bottom-actions {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 30px;
  flex-wrap: wrap;
}

.pwa-btn, .logout-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 25px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.pwa-btn {
  background: #4CAF50;
  color: white;
}

.pwa-btn:hover {
  background: #45a049;
  transform: translateY(-2px);
}

.logout-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  backdrop-filter: blur(10px);
}

.logout-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

@media (max-width: 768px) {
  .home {
    padding: 15px;
  }
  
  .scan-btn {
    padding: 12px 20px;
    font-size: 1rem;
  }
  
  .format-list {
    grid-template-columns: 1fr;
  }
  
  .bottom-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .pwa-btn, .logout-btn {
    width: 100%;
    max-width: 250px;
  }
}
</style>