import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> | boolean {
    // Check if token is valid before allowing access
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth']);
      return false;
    }

    return this.authService.currentUser$.pipe(
      take(1),
      map(user => {
        if (user && this.authService.isAuthenticated()) {
          return true;
        } else {
          this.authService.logout(); // Force logout if user exists but token is invalid
          this.router.navigate(['/auth']);
          return false;
        }
      })
    );
  }
}