console.log('✅ auth.js loaded');

// Конфигурация Telegram бота
const BOT_USERNAME = 'u40ta_bot';

// Обработка callback от Telegram
async function onTelegramAuth(user) {
    console.log('🔴 [Frontend] Telegram auth received:', user);
    
    // Валидация данных
    if (!user || !user.id) {
        console.error('Invalid user data received');
        alert('Ошибка: неверные данные от Telegram');
        return;
    }
    
    // Показываем "Загрузка..."
    document.getElementById('user-info').textContent = 'Проверяем авторизацию...';
    document.getElementById('user-data').style.display = 'block';
    
    try {
        // Ждём ответ от бэкенда
        console.log('🔴 [Frontend] Отправляем данные на бэкенд...');
        const backendResponse = await sendToBackend(user);
        console.log('🔴 [Frontend] Ответ бэкенда:', backendResponse);
        
        // Обрабатываем ответ бэкенда
        if (backendResponse.status === 'success') {
            console.log('🔴 [Frontend] Успешная авторизация');
            localStorage.setItem('telegram_user', JSON.stringify(user));
            localStorage.setItem('telegram_auth_date', Date.now());
            displayUserData(user);
            alert('Успешная авторизация');
        } else if (backendResponse.status === 'pending') {
            console.log('🔴 [Frontend] Требуется одобрение администратора');
            alert('Подождите');
            // Очищаем данные, т.к. не авторизованы
            document.getElementById('user-data').style.display = 'none';
            localStorage.removeItem('telegram_user');
            localStorage.removeItem('telegram_auth_date');
        } else if (backendResponse.status === 'error') {
            throw new Error(backendResponse.message);
        } else {
            throw new Error('Неизвестный ответ от сервера');
        }
        
    } catch (error) {
        console.error('Auth error:', error);
        alert('Ошибка авторизации: ' + error.message);
        document.getElementById('user-data').style.display = 'none';
        localStorage.removeItem('telegram_user');
        localStorage.removeItem('telegram_auth_date');
    }
}

// Отображение данных пользователя
function displayUserData(user) {
    const userData = {
        id: user.id,
        first_name: user.first_name || 'Не указано',
        last_name: user.last_name || 'Не указано',
        username: user.username || 'Не указан',
        photo_url: user.photo_url || 'Не указана',
        auth_date: new Date(user.auth_date * 1000).toLocaleString('ru-RU'),
        hash: user.hash ? user.hash.substring(0, 20) + '...' : 'Не указан'
    };
    
    document.getElementById('user-info').textContent = JSON.stringify(userData, null, 2);
    document.getElementById('user-data').style.display = 'block';
}

// Выход из системы
function logout() {
    localStorage.removeItem('telegram_user');
    localStorage.removeItem('telegram_auth_date');
    document.getElementById('user-data').style.display = 'none';
    console.log('User logged out');
    
    // Показываем кнопку авторизации снова
    document.querySelector('.telegram-btn').style.display = 'block';
}

// Функция для отправки данных на бекенд
async function sendToBackend(userData) {
    console.log('🔴 [Frontend] Sending to backend:', userData);
    
    const BACKEND_URL = '/api/auth/telegram';
    
    const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
}

// Инициализация Telegram Widget
function initTelegramWidget() {
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-auth-url', '/api/auth/telegram');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'true');
    script.setAttribute('data-radius', '20');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.async = true;
    
    const buttonContainer = document.querySelector('.telegram-btn');
    if (buttonContainer) {
        buttonContainer.innerHTML = '';
        buttonContainer.appendChild(script);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initTelegramWidget();
    
    // Проверяем существующую авторизацию
    const savedUser = localStorage.getItem('telegram_user');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            displayUserData(user);
        } catch (e) {
            console.error('Error parsing saved user:', e);
            localStorage.removeItem('telegram_user');
        }
    }
});