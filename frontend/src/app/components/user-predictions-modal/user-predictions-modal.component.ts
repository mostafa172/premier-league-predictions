import { Component, Input, OnInit, OnDestroy, Output, EventEmitter, OnChanges, SimpleChanges, HostListener } from '@angular/core';
import { PredictionService } from '../../services/prediction.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';

interface User {
  id: number;
  username: string;
}

interface UserPredictionData {
  user: User;
  gameweek: number;
  fixtures: any[];
  predictions: any[];
  totalPoints: number;
}

@Component({
  selector: 'app-user-predictions-modal',
  templateUrl: './user-predictions-modal.component.html',
  styleUrls: ['./user-predictions-modal.component.scss']
})
export class UserPredictionsModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isOpen = false;
  @Input() currentGameweek = 1;
  @Input() users: User[] = [];

  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();
  // Back-compat for parent listening to (close)
  @Output() close = new EventEmitter<void>();

  selectedUserId: number | null = null;
  selectedGameweek = 1;
  userPredictionData: UserPredictionData | null = null;
  loading = false;
  error = '';
  private subscriptions: Subscription[] = [];
  // Filtered users for selection (exclude current user and zero-point users)
  filteredUsers: User[] = [];
  private currentUserId: number | null = null;

  constructor(private predictionService: PredictionService, private authService: AuthService) {}

  ngOnInit(): void {
    this.selectedGameweek = this.currentGameweek;
    const me = this.authService.getCurrentUser();
    this.currentUserId = me?.id ?? null;
    this.refreshFilteredUsers();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      // Reset transient UI state on open
      this.loading = false;
      this.error = '';
      // Keep selections to allow quick re-open review
    }
    if (changes['users']) {
      this.refreshFilteredUsers();
    }
  }

  onUserSelect(userId: number | null): void {
    if (userId == null) {
      // Reset selections and clear data when default option is chosen
      this.selectedUserId = null;
      this.userPredictionData = null;
      this.error = '';
      this.loading = false;
      return;
    }
    this.selectedUserId = userId;
    this.loadUserPredictions();
  }

  onGameweekChange(gameweek: number): void {
    this.selectedGameweek = gameweek;
    if (this.selectedUserId != null) {
      this.loadUserPredictions();
    } else {
      // No user selected: clear displayed data for the new gameweek
      this.userPredictionData = null;
      this.error = '';
      this.loading = false;
    }
  }

  loadUserPredictions(): void {
    if (!this.selectedUserId) return;

    this.loading = true;
    this.error = '';
    this.userPredictionData = null;

    const sub = this.predictionService.getOtherUserPredictions(this.selectedUserId, this.selectedGameweek)
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success) {
            this.userPredictionData = response.data;
          } else {
            this.error = 'Failed to load predictions';
          }
        },
        error: (error) => {
          this.loading = false;
          this.error = 'Error loading predictions';
          console.error('Error loading user predictions:', error);
        }
      });

    this.subscriptions.push(sub);
  }

  getPredictionForFixture(fixtureId: number): any {
    if (!this.userPredictionData) return null;
    return this.userPredictionData.predictions.find(p => p.fixtureId === fixtureId);
  }

  getPredictionPoints(fixture: any): number {
    const prediction = this.getPredictionForFixture(fixture.id);
    return prediction?.points || 0;
  }

  closeModal(): void {
    // Emit to parent to drive the open/close state (always emit false so parent resets)
    this.isOpenChange.emit(false);
    // Also update local Input to ensure view closes even if parent doesn't bind
    this.isOpen = false;
    this.closed.emit();
    this.close.emit();
    // Local cleanup (do not mutate Input directly)
    this.selectedUserId = null;
    this.userPredictionData = null;
    this.error = '';
  }

  getFormattedDate(date: string): string {
    const utcDate = new Date(date);
    const localDate = new Date(
      utcDate.getUTCFullYear(),
      utcDate.getUTCMonth(),
      utcDate.getUTCDate(),
      utcDate.getUTCHours(),
      utcDate.getUTCMinutes(),
      utcDate.getUTCSeconds()
    );

    return localDate.toLocaleString([], {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  isFixtureDisabled(fixture: any): boolean {
    const deadline = new Date(fixture.deadline);
    const now = new Date();
    return (
      now >= deadline ||
      fixture.status === "finished" ||
      fixture.status === "live"
    );
  }

  // UX: Allow Escape key to close when open
  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent): void {
    if (this.isOpen) {
      event.preventDefault();
      this.closeModal();
    }
  }

  // Public method to retry after error
  retryLoad(): void {
    this.loadUserPredictions();
  }

  private refreshFilteredUsers(): void {
    // If no users list, nothing to filter
    if (!this.users || this.users.length === 0) {
      this.filteredUsers = [];
      return;
    }

    // Fetch leaderboard to know who has points
    const sub = this.predictionService.getLeaderboard().subscribe({
      next: (resp) => {
        if (resp?.success && Array.isArray(resp.data)) {
          const usersWithPoints = new Set<number>(resp.data.filter((u: any) => (u.totalPoints ?? 0) > 0).map((u: any) => u.userId));
          this.filteredUsers = this.users.filter(u => {
            const notMe = this.currentUserId == null ? true : u.id !== this.currentUserId;
            const hasPoints = usersWithPoints.has(u.id);
            return notMe && hasPoints;
          });
        } else {
          // Fallback: exclude only current user
          this.filteredUsers = this.users.filter(u => (this.currentUserId == null ? true : u.id !== this.currentUserId));
        }
      },
      error: () => {
        // On error, fallback to excluding current user only
        this.filteredUsers = this.users.filter(u => (this.currentUserId == null ? true : u.id !== this.currentUserId));
      }
    });
    this.subscriptions.push(sub);
  }
}
