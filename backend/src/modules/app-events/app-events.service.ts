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

  // Для Home.vue (список вложений)
  notifyEmailAttachmentsUpdated(): void {
    this.eventSubject.next({ 
      type: 'email-attachments-updated',
      message: 'Список вложений обновлён'
    });
  }

  // Для StatementPage.vue (данные ведомости)
  notifyStatementUpdated(zavod: string, sklad: string, doc_type: string): void {
    this.eventSubject.next({
      type: 'statement-updated',
      message: `Ведомость обновлена: ${zavod}/${sklad}/${doc_type}`,
      data: { zavod, sklad, doc_type }
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

  // Для получения потока событий (используется в контроллере)
  getEventStream(): Observable<{ message: string }> {
    return this.eventSubject.asObservable();
  }
}