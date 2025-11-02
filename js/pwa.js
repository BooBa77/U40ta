// PWA функциональность
let deferredPrompt;

function initPWA() {
    const statusElement = document.getElementById('pwa-status-text');
    const installButton = document.getElementById('install-btn');
    
    // Проверка поддержки Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registered: ', registration);
                statusElement.textContent = 'PWA: ✅ Готов к установке';
                
                // Показываем статус в зависимости от типа отображения
                if (window.matchMedia('(display-mode: standalone)').matches) {
                    statusElement.textContent = 'PWA: ✅ Запущено как приложение';
                    installButton.style.display = 'none';
                }
            })
            .catch(function(error) {
                console.log('ServiceWorker registration failed: ', error);
                statusElement.textContent = 'PWA: ⚠️ Service Worker не зарегистрирован';
            });
    } else {
        statusElement.textContent = 'PWA: ❌ Не поддерживается';
    }
    
    // Обработка установки PWA
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installButton.style.display = 'block';
        
        installButton.addEventListener('click', () => {
            installButton.style.display = 'none';
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted PWA installation');
                    statusElement.textContent = 'PWA: ✅ Установлено';
                } else {
                    console.log('User dismissed PWA installation');
                    installButton.style.display = 'block';
                }
                deferredPrompt = null;
            });
        });
    });
    
    // Если уже установлено как PWA
    window.addEventListener('appinstalled', (evt) => {
        console.log('PWA was installed');
        installButton.style.display = 'none';
        statusElement.textContent = 'PWA: ✅ Установлено как приложение';
    });
}
