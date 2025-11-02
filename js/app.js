// Основная логика приложения
window.addEventListener('load', function() {
    const savedUser = localStorage.getItem('telegram_user');
    const authDate = localStorage.getItem('telegram_auth_date');
    
    // Проверяем не устарела ли сессия (24 часа)
    if (savedUser && authDate) {
        const hoursDiff = (Date.now() - parseInt(authDate)) / (1000 * 60 * 60);
        if (hoursDiff < 24) {
            const user = JSON.parse(savedUser);
            displayUserData(user);
            console.log('Restored user session:', user);
        } else {
            // Сессия устарела
            logout();
        }
    }
    
    // Проверяем загрузился ли Telegram Widget
    setTimeout(() => {
        const telegramWidget = document.querySelector('.telegram-widget');
        if (!telegramWidget || telegramWidget.children.length === 0) {
            console.log('Telegram Widget not loaded, showing fallback');
            document.getElementById('fallback-telegram-btn').style.display = 'block';
        }
    }, 2000);
    
    // Инициализация PWA
    initPWA();
});
