const checkAuthStatus = () => {
  console.log('=== checkAuthStatus START ===');
  const pendingToken = localStorage.getItem('pending_token');
  const authToken = localStorage.getItem('auth_token');
  
  console.log('authToken from localStorage:', authToken);
  console.log('pendingToken from localStorage:', pendingToken);
  
  if (authToken) {
    console.log('Есть authToken, редирект на /');
    router.push('/');
    return;
  }
  
  if (pendingToken) {
    console.log('Есть pendingToken, показываем экран ожидания');
    isPending.value = true;
  }
  console.log('=== checkAuthStatus END ===');
}

const initTelegramWidget = () => {
  console.log('=== initTelegramWidget START ===');
  console.log('isPending.value:', isPending.value);
  
  if (isPending.value) {
    console.log('Пользователь в pending, пропускаем инициализацию');
    return;
  }
  
  console.log('Создаем Telegram Widget script...');
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
  
  // Логируем события скрипта
  script.onload = () => {
    console.log('✅ Telegram Widget script ЗАГРУЖЕН успешно');
    console.log('window.Telegram exists:', !!window.Telegram);
  };
  
  script.onerror = (error) => {
    console.error('❌ Telegram Widget script НЕ ЗАГРУЖЕН:', error);
  };
  
  if (telegramWidget.value) {
    console.log('telegramWidget ref найден, добавляем скрипт');
    telegramWidget.value.innerHTML = '';
    telegramWidget.value.appendChild(script);
  } else {
    console.error('telegramWidget ref НЕ НАЙДЕН!');
  }
  console.log('=== initTelegramWidget END ===');
}

const onTelegramAuth = async (user) => {
  console.log('=== onTelegramAuth START ===');
  console.log('Telegram auth success:', user);

  if (!user || !user.id) {
    console.error('Invalid user data received');
    return;
  }

  try {
    console.log('Отправляем запрос на /api/auth/telegram...');
    const response = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(user)
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Backend response:', data);

    if (data.status === 'success' && data.access_token) {
      console.log('✅ Авторизация успешна, сохраняем токен');
      localStorage.setItem('auth_token', data.access_token);
      router.push('/');
    } else if (data.status === 'pending') {
      console.log('⏳ Пользователь в ожидании, сохраняем pending_token');
      localStorage.setItem('pending_token', 'true');
      isPending.value = true;
    } else {
      console.error('❌ Ошибка авторизации:', data.message);
      alert('Ошибка авторизации: ' + (data.message || 'Неизвестная ошибка'));
    }
  } catch (error) {
    console.error('❌ Backend error:', error);
    alert('Ошибка соединения с сервером');
  }
  console.log('=== onTelegramAuth END ===');
}

onMounted(() => {
  console.log('=== onMounted START ===');
  checkAuthStatus();
  initTelegramWidget();
  detectDevice();
  
  window.onTelegramAuth = onTelegramAuth;
  console.log('window.onTelegramAuth установлен');
  console.log('=== onMounted END ===');
});