/* filepath: frontend/src/app/app.component.ts */
import { Component, OnInit, OnDestroy } from "@angular/core";
import { AuthService } from "./services/auth.service";
import { LoadingService } from "./services/loading.service";
import { Subscription } from "rxjs";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent implements OnInit, OnDestroy {
  title = "premier-league-predictions";
  isLoggedIn = false;
  currentUser: any = null;
  isLoading = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    // Initialize auth state from storage first
    this.currentUser = this.authService.getCurrentUser();
    this.isLoggedIn = this.authService.isAuthenticated();

    // Subscribe to loading state
    const loadingSub = this.loadingService.loading$.subscribe(
      (loading: boolean) => {
        this.isLoading = loading;
      }
    );
    this.subscriptions.push(loadingSub);

    // Subscribe to auth changes
    const authSub = this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
      this.isLoggedIn = !!user;
    });
    this.subscriptions.push(authSub);

    // Only validate token if we think we're logged in
    if (this.isLoggedIn) {
      this.validateToken();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private validateToken(): void {
    this.authService.checkTokenValidity().subscribe({
      next: (response: any) => {
        if (!response.success) {
          this.authService.logout();
        }
      },
      error: () => {
        this.authService.logout();
      },
    });
  }

  logout(): void {
    this.authService.logout();
  }

  get isAdmin(): boolean {
    return (
      this.currentUser?.role === "admin" || this.currentUser?.isAdmin || false
    );
  }
}
