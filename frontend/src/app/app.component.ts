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
      
      // Redirect logic
      const currentUrl = this.router.url;
      if (user && (currentUrl === '/auth' || currentUrl === '/')) {
        this.router.navigate(['/fixtures']);
      } else if (!user && currentUrl !== '/auth') {
        this.router.navigate(['/auth']);
      }
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/auth']);
  }
}