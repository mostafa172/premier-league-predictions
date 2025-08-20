import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, timer } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { User } from '../models/user.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser$: Observable<User | null>;
  private apiUrl = `${environment.apiUrl}/auth`;
  private tokenExpirationTimer: any;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Check if user is stored in localStorage on service initialization
    const storedUser = localStorage.getItem('currentUser');
    const storedToken = localStorage.getItem('token');
    
    let initialUser = null;
    if (storedUser && storedToken) {
      try {
        initialUser = JSON.parse(storedUser);
        // Check if token is expired
        if (this.isTokenExpired(storedToken)) {
          this.logout();
          initialUser = null;
        } else {
          // Set up auto-logout timer for remaining time
          this.setTokenExpirationTimer(storedToken);
        }
      } catch (e) {
        // If parsing fails, clear localStorage
        this.logout();
      }
    }

    this.currentUserSubject = new BehaviorSubject<User | null>(initialUser);
    this.currentUser$ = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { email, password })
      .pipe(
        map(response => {
          if (response.success && response.user && response.token) {
            // Store user details and jwt token in local storage
            localStorage.setItem('currentUser', JSON.stringify(response.user));
            localStorage.setItem('token', response.token);
            this.currentUserSubject.next(response.user);
            
            // Set up auto-logout timer
            this.setTokenExpirationTimer(response.token);
          }
          return response;
        }),
        catchError(this.handleError.bind(this))
      );
  }

  register(username: string, email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, { username, email, password })
      .pipe(
        map(response => {
          if (response.success && response.user && response.token) {
            // Store user details and jwt token in local storage
            localStorage.setItem('currentUser', JSON.stringify(response.user));
            localStorage.setItem('token', response.token);
            this.currentUserSubject.next(response.user);
            
            // Set up auto-logout timer
            this.setTokenExpirationTimer(response.token);
          }
          return response;
        }),
        catchError(this.handleError.bind(this))
      );
  }

  logout(): void {
    // Clear the auto-logout timer
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
    }
    
    // Remove user from local storage and set current user to null
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    this.currentUserSubject.next(null);
    
    // Navigate to login page
    this.router.navigate(['/auth']);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    return !!this.currentUserValue && !!token && !this.isTokenExpired(token);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  // Check if token is expired
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      return Date.now() >= expirationTime;
    } catch (error) {
      return true; // If we can't parse the token, consider it expired
    }
  }

  // Set up automatic logout timer
  private setTokenExpirationTimer(token: string): void {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      const timeUntilExpiration = expirationTime - Date.now();
      
      // Set timer to logout 1 minute before actual expiration
      const logoutTime = Math.max(timeUntilExpiration - 60000, 0);
      
      this.tokenExpirationTimer = setTimeout(() => {
        this.logout();
        alert('Your session has expired. Please log in again.');
      }, logoutTime);
      
      console.log(`Token will expire in ${Math.round(timeUntilExpiration / 1000 / 60)} minutes`);
    } catch (error) {
      console.error('Error setting token expiration timer:', error);
    }
  }

  // Handle HTTP errors
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      if (error.status === 401 || error.status === 403) {
        // Token expired or invalid
        this.logout();
        errorMessage = 'Session expired. Please log in again.';
      } else if (error.error?.message) {
        errorMessage = error.error.message;
      } else {
        errorMessage = `Server error: ${error.status}`;
      }
    }
    
    return throwError(errorMessage);
  }

  // Get time remaining until token expires (in minutes)
  getTokenTimeRemaining(): number {
    const token = this.getToken();
    if (!token) return 0;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000;
      const timeRemaining = expirationTime - Date.now();
      return Math.max(Math.round(timeRemaining / 1000 / 60), 0);
    } catch (error) {
      return 0;
    }
  }
}