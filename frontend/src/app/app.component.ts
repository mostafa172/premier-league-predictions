import { Component, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Premier League Predictions';
  isAuthenticated = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.isAuthenticated = !!user;
    });
  }

  logout(): void {
    this.authService.logout();
  }

  get currentUser() {
    return this.authService.getCurrentUser();
  }

  get isAdmin(): boolean {
    return this.currentUser?.isAdmin || false;
  }

  get tokenTimeRemaining(): string {
    return this.authService.getTokenTimeRemaining();
  }

  // Add missing methods for the template
  getSessionTimeRemaining(): number {
    const timeStr = this.authService.getTokenTimeRemaining();
    if (timeStr === 'Not logged in' || timeStr === 'Expired' || timeStr === 'Invalid token') {
      return 0;
    }
    
    // Extract minutes from string like "30m" or "1h 30m"
    const minutesMatch = timeStr.match(/(\d+)m/);
    const hoursMatch = timeStr.match(/(\d+)h/);
    
    let totalMinutes = 0;
    if (hoursMatch) {
      totalMinutes += parseInt(hoursMatch[1]) * 60;
    }
    if (minutesMatch) {
      totalMinutes += parseInt(minutesMatch[1]);
    }
    
    return totalMinutes;
  }

  isSessionExpiringSoon(): boolean {
    const remaining = this.getSessionTimeRemaining();
    return remaining > 0 && remaining <= 10; // Expiring within 10 minutes
  }
}