/* filepath: frontend/src/app/services/loading.service.ts */
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  // Make sure initial state is FALSE, not TRUE
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor() {
    console.log('🚀 LoadingService initialized with loading:', false); // Debug log
  }

  setLoading(loading: boolean): void {
    console.log('⚡ LoadingService.setLoading called with:', loading); // Debug log
    this.loadingSubject.next(loading);
  }

  show(): void {
    console.log('👁️ LoadingService.show() called'); // Debug log
    this.setLoading(true);
  }

  hide(): void {
    console.log('🙈 LoadingService.hide() called'); // Debug log
    this.setLoading(false);
  }
}