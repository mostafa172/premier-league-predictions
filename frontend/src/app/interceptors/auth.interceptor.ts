/* filepath: frontend/src/app/interceptors/auth.interceptor.ts */
import { Injectable } from "@angular/core";
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
} from "@angular/common/http";
import { Observable, throwError } from "rxjs";
import { catchError } from "rxjs/operators";
import { AuthService } from "../services/auth.service";

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Add auth token to requests
    const token = this.authService.getToken();

    console.log("🔧 Interceptor running for:", req.url);
    console.log("🔧 Token available:", !!token);
    console.log("🔧 Is authenticated:", this.authService.isAuthenticated());

    if (token && this.authService.isAuthenticated()) {
      console.log("🔧 Adding Authorization header");
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      });
    } else {
      console.log("🔧 No token or not authenticated, skipping header");
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // Handle 401/403 errors globally
        console.log(
          "❌ HTTP Error in interceptor:",
          error.status,
          error.message
        );
        if (error.status === 401 || error.status === 403) {
          console.log("❌ Unauthorized error, logging out");
          this.authService.logout();
        }
        return throwError(() => error);
      })
    );
  }
}
