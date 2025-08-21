/* filepath: frontend/src/app/services/auth.service.ts */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

interface User {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
}

interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    user: User;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://localhost:3000/api';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Initialize current user from localStorage
    const token = this.getToken();
    if (token) {
      const user = this.getCurrentUser();
      if (user) {
        this.currentUserSubject.next(user);
      }
    }
  }

  // Add missing isAuthenticated method
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getCurrentUser();
    return !!(token && user);
  }

  // Add missing currentUserValue getter
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
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
      } catch {
        return null;
      }
    }
    return null;
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated();
  }

  checkTokenValidity(): Observable<{success: boolean, user?: User}> {
    const token = this.getToken();
    if (!token) {
      return new Observable(observer => {
        observer.next({ success: false });
        observer.complete();
      });
    }

    return this.http.get<{success: boolean, user?: User}>(`${this.API_URL}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}