import { Component, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Premier League Predictions';
  isAuthenticated = false;
  currentUser: any = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.isAuthenticated = !!user;
      
      // Redirect logic - improved session handling
      const currentUrl = this.router.url;
      
      if (user) {
        // User is authenticated
        if (currentUrl === '/auth' || currentUrl === '/') {
          this.router.navigate(['/fixtures']);
        }
      } else {
        // User is not authenticated
        if (currentUrl !== '/auth') {
          this.router.navigate(['/auth']);
        }
      }
    });

    // Check token validity on app startup
    this.checkTokenValidity();
  }

  private checkTokenValidity(): void {
    // Force check if current token is still valid
    if (!this.authService.isAuthenticated() && this.authService.getToken()) {
      // Token exists but is invalid/expired
      this.authService.logout();
    }
  }

  logout() {
    this.authService.logout();
  }

  // Get session time remaining for display (optional)
  getSessionTimeRemaining(): number {
    return this.authService.getTokenTimeRemaining();
  }

  // Check if session is about to expire (optional)
  isSessionExpiringSoon(): boolean {
    const timeRemaining = this.getSessionTimeRemaining();
    return timeRemaining > 0 && timeRemaining <= 5; // 5 minutes or less
  }
}