/* filepath: frontend/src/app/app.component.ts */
import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from './services/auth.service';
import { LoadingService } from './services/loading.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'premier-league-predictions';
  isLoggedIn = false;
  currentUser: any = null;
  isLoading = false; // This should control the loading component
  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    // Initialize auth state
    this.checkAuthStatus();
    
    // Subscribe to loading state - THIS WAS MISSING OR WRONG
    const loadingSub = this.loadingService.loading$.subscribe(
      (loading: boolean) => {
        this.isLoading = loading;
        console.log('🔄 Loading state changed to:', loading); // Debug log
      }
    );
    this.subscriptions.push(loadingSub);

    // Subscribe to auth changes
    const authSub = this.authService.currentUser$.subscribe(
      (user) => {
        this.currentUser = user;
        this.isLoggedIn = !!user;
      }
    );
    this.subscriptions.push(authSub);
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private checkAuthStatus(): void {
    const token = this.authService.getToken();
    if (token) {
      this.authService.checkTokenValidity().subscribe({
        next: (response: any) => {
          if (response.success) {
            this.currentUser = response.user;
            this.isLoggedIn = true;
          } else {
            this.authService.logout();
          }
        },
        error: () => {
          this.authService.logout();
        }
      });
    }
  }

  logout(): void {
    this.authService.logout();
  }

  get isAdmin(): boolean {
    return this.currentUser?.isAdmin || false;
  }
}