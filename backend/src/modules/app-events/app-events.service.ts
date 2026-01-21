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

  // Для Home.vue (новое вложение)
  notifyEmailAttachmentLoaded(): void {
    this.eventSubject.next({ 
      type: 'email-attachment-loaded',
      message: 'Новое вложение загружено'
    });
  }

  // Для Home.vue и StatementPage.vue (удаление ведомости)
  notifyEmailAttachmentDeleted(attachmentId: number): void {
    this.eventSubject.next({ 
      type: 'email-attachment-deleted',
      message: 'Вложение удалено',
      data: { attachmentId }
    });
  }

  // Для StatementPage.vue (смена активной ведомости)
  notifyStatementActiveChanged(attachmentId: number): void {
    this.eventSubject.next({
      type: 'statement-active-changed',
      message: `Ведомость ${attachmentId} стала активной у другого пользователя`,
      data: { attachmentId }
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