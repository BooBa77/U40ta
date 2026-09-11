import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

/**
 * Тип SSE-события.
 */
interface AppEvent {
  type: string;
  message: string;
  data?: any;
}

/**
 * Сервис SSE-уведомлений.
 * 
 * ## Назначение
 * Отправляет события фронтенду через Server-Sent Events.
 * Фронтенд подписывается на `/api/app-events/sse` и получает события в реальном времени.
 * 
 * ## Принцип именования
 * - `access-changed` — права доступа
 * - `user-data-updated` — данные пользователя
 * - `inventory-*` — инвентаризационные события
 * - `objects-changed` — изменения в таблице objects
 */
@Injectable()
export class AppEventsService {
  
  private eventSubject = new Subject<AppEvent>();

  /**
   * !!! DEBUG !!!
   * Отправить событие в поток с логированием.
   * Используется вместо прямого this.eventSubject.next() для отладки.
   * 
   * @param event - событие для отправки
   */
  private emit(event: AppEvent): void {
    console.log(`[SSE] emit: type=${event.type}`, event.data || '');
    this.eventSubject.next(event);
  }  

  // ============================================================================
  // ДОСТУП И ПОЛЬЗОВАТЕЛИ
  // ============================================================================

  /**
   * Изменение прав доступа.
   * Home.vue перепроверяет роли.
   * @param userId - ID пользователя, чьи права изменились
   */
  notifyAccessChanged(userId: number): void {
    this.emit({ 
      type: 'access-changed',
      message: 'Права доступа изменены',
      data: { userId }
    });
  }

  /**
   * Обновление данных пользователя (аббревиатура).
   * Home.vue обновляет отображение.
   * @param userId - ID пользователя
   */
  notifyUserDataUpdated(userId: number): void {
    this.emit({ 
      type: 'user-data-updated',
      message: 'Данные пользователя обновлены',
      data: { userId }
    });
  }

  // ============================================================================
  // ИНВЕНТАРИЗАЦИЯ
  // ============================================================================

  /**
   * Изменение доступа МОЛа к инвентаризации.
   * Home.vue проверяет наличие строк для МОЛа и показывает/скрывает кнопку "ИНВЕНТАРИЗАЦИЯ".
   * MolInventoryModal обновляет список строк, если открыт.
   * 
   * @param userId - ID пользователя-МОЛа, чей доступ изменился
   */
  notifyMolAccessChanged(userId: number): void {
    this.emit({
      type: 'mol-access-changed',
      message: 'Доступ МОЛа к инвентаризации изменён',
      data: { userId }
    });
  }  

  /**
   * Новые инвентаризационные ведомости ревизора.
   * InventoryBooksSection.vue обновляет список.
   * @param email - email ревизора
   */
  notifyInventoryStatementLoaded(email: string): void {
    this.emit({
      type: 'inventory-statement-loaded',
      message: 'Получены новые инвентаризационные ведомости',
      data: { email }
    });
  }

  /**
   * Изменение инвентаризационной книги (создание, обновление, удаление).
   * InventoryBooksSection обновляет список.
   * InventoryCheckModal закрывается у других ревизоров.
   * @param bookId - ID книги
   */
  notifyInventoryBookChanged(bookId: number): void {
    this.emit({
      type: 'inventory-book-changed',
      message: 'Инвентаризационная книга изменена',
      data: { bookId }
    });
  }

  // ============================================================================
  // ОБЪЕКТЫ
  // ============================================================================

  /**
   * Изменение объектов на складе (создание, обновление, удаление).
   * StatementPage.vue делает reload() если ведомость содержит этот склад.
   * @param userId - ID пользователя, сделавшего изменение
   * @param zavod - номер завода
   * @param sklad - код склада
   */
  notifyObjectsChanged(userId: number, zavod: number, sklad: string): void {
    this.emit({
      type: 'objects-changed',
      message: 'Объекты на складе изменились',
      data: { userId, zavod, sklad }
    });
  }

  // ============================================================================
  // ПОТОК СОБЫТИЙ
  // ============================================================================

  /**
   * Получить поток событий для SSE-контроллера.
   * @returns Observable потока событий
   */
  getEventStream(): Observable<AppEvent> {
    return this.eventSubject.asObservable();
  }
}