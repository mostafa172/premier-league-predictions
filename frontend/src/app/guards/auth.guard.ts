import { Injectable } from "@angular/core";
import {
  CanActivate,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from "@angular/router";
import { AuthService } from "../services/auth.service";
import { Observable, of } from "rxjs";
import { map, catchError, take } from "rxjs/operators";

@Injectable({
  providedIn: "root",
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Check if user is authenticated
    if (this.authService.isAuthenticated()) {
      // If we have token and user, validate the token
      return this.authService.checkTokenValidity().pipe(
        take(1),
        map((response) => {
          if (response.success) {
            return true;
          } else {
            this.authService.logout();
            this.router.navigate(["/auth"]);
            return false;
          }
        }),
        catchError(() => {
          this.authService.logout();
          this.router.navigate(["/auth"]);
          return of(false);
        })
      );
    } else {
      // No token or user data
      this.router.navigate(["/auth"]);
      return of(false);
    }
  }
}
