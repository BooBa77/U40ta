export function useLogger() {
  const log = async (content) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        credentials: 'include',
        body: JSON.stringify({ content }),
      });
      
      if (!response.ok) {
        // Не бросаем ошибку, чтобы логирование не ломало приложение
        console.warn('Failed to send log:', response.status);
      }
    } catch (e) {
      // Тихая ошибка — логирование не должно ломать интерфейс
      console.error('Failed to send log:', e);
    }
  };
  
  return { log };
}