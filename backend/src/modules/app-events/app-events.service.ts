import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

@Injectable()
export class AppEventsService {
  private eventSubject = new Subject<{ message: string }>();

  // Для отправки событий всем клиентам
  notifyAll(): void {
    this.eventSubject.next({ message: 'update' });
  }

  // Для получения потока событий (используется в контроллере)
  getEventStream(): Observable<{ message: string }> {
    return this.eventSubject.asObservable();
  }
}