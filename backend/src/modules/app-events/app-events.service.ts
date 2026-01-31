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

  // Для EmailAttachmentsSection.vue (новое вложение)
  notifyStatementLoaded(): void {
    this.eventSubject.next({ 
      type: 'statement-loaded',
      message: 'Новая ведомость загружена'
    });
  }

  // Для EmailAttachmentsSection.vue и StatementPage.vue (удаление ведомости)
  notifyStatementDeleted(attachmentId: number): void {
    this.eventSubject.next({ 
      type: 'statement-deleted',
      message: 'Ведомость удалена',
      data: { attachmentId }
    });
  }

  // Для EmailAttachmentsSection.vue и StatementPage.vue (смена активной ведомости)
  notifyStatementActiveChanged(
    attachmentId: number, 
    zavod: number, 
    sklad: string
  ): void {
    this.eventSubject.next({
      type: 'statement-active-changed',
      message: `Ведомость ${attachmentId} стала активной у другого пользователя`,
      data: { 
        attachmentId,
        zavod,
        sklad
      }
    });
  }
  // Для StatementPage.vue (обновление данных ведомости)
  notifyStatementUpdated(attachmentId: number): void {
    this.eventSubject.next({
      type: 'statement-updated',
      message: `Ведомость ${attachmentId} обновлена`,
      data: { attachmentId }
    });
  }

  // Для получения потока событий (используется в контроллере)
  getEventStream(): Observable<{ message: string }> {
    return this.eventSubject.asObservable();
  }
}