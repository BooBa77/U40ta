import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

// Определяем тип события
interface AppEvent {
  message: string;
  type?: string;
  data?: any;
}

@Injectable()
export class AppEventsService {
  
  private eventSubject = new Subject<AppEvent>();

  // Для Home.vue (изменение прав доступа)
  notifyAccessChanged(userId: number): void {
    this.eventSubject.next({ 
      type: 'access-changed',
      message: 'Права доступа изменены',
      data: { userId }
    });
  }

  // Для Home.vue (обновление данных пользователя, аббревиатура)
  notifyUserDataUpdated(userId: number): void {
    this.eventSubject.next({ 
      type: 'user-data-updated',
      message: 'Данные пользователя обновлены',
      data: { userId }
    });
  }

  // Для InventoryModule (новые инвентаризационные строки)
  notifyInventoryStatementLoaded(email: string): void {
    this.eventSubject.next({
      type: 'inventory-statement-loaded',
      message: 'Получены новые инвентаризационные ведомости',
      data: { email }
    });
  }

  /**
   * Для InventoryBooksSection.vue и InventoryModal.vue (изменение инвентаризационной книги).
   * Отправляется при любом изменении книги: создание, обновление строк, удаление.
   * InventoryModal.vue закрывается у других ревизоров, если они работают с той же книгой.
   */
  notifyInventoryBookChanged(bookId: number): void {
    this.eventSubject.next({
      type: 'inventory-book-changed',
      message: 'Инвентаризационная книга изменена',
      data: { bookId }
    });
  }

  // Для получения потока событий (используется в контроллере)
  getEventStream(): Observable<{ message: string }> {
    return this.eventSubject.asObservable();
  }
}