/* filepath: frontend/src/app/services/loading.service.ts */
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }

  show(): void {
    this.setLoading(true);
  }

  hide(): void {
    this.setLoading(false);
  }
}