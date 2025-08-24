/* filepath: frontend/src/app/services/auth.service.ts */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';

interface User {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
}

interface AuthResponse {
  success: boolean;
  data?: {
    user: User;
    token: string;
  };
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Initialize from localStorage on service creation
    this.initializeFromStorage();
  }

  private initializeFromStorage(): void {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        this.currentUserSubject.next(user);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        this.clearStorage();
      }
    }
  }

  private clearStorage(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getCurrentUser();
    return !!(token && user);
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/login`, {
      email,
      password
    }).pipe(
      tap(response => {
        if (response.success && response.data?.token && response.data?.user) {
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          this.currentUserSubject.next(response.data.user);
        }
      })
    );
  }

  register(username: string, email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/register`, {
      username,
      email,
      password
    });
  }

  logout(): void {
    this.clearStorage();
    this.router.navigate(['/auth']);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated();
  }

  // Add token validation method
  checkTokenValidity(): Observable<any> {
    return this.http.get(`${this.API_URL}/auth/profile`);
  }
}