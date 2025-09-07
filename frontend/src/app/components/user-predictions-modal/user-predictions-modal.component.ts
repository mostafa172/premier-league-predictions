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
  @Input() selectedUser: User | null = null;

  @Output() isOpenChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();
  // Back-compat for parent listening to (close)
  @Output() close = new EventEmitter<void>();

  selectedGameweek = 1;
  userPredictionData: UserPredictionData | null = null;
  loading = false;
  error = '';
  private subscriptions: Subscription[] = [];
  private currentUserId: number | null = null;

  constructor(private predictionService: PredictionService, private authService: AuthService) {}

  ngOnInit(): void {
    this.selectedGameweek = this.currentGameweek;
    const me = this.authService.getCurrentUser();
    this.currentUserId = me?.id ?? null;
    
    // If a user is pre-selected, load their predictions
    if (this.selectedUser) {
      this.loadUserPredictions();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      // Reset transient UI state on open
      this.loading = false;
      this.error = '';
    }
    if (changes['currentGameweek']) {
      // Update selected gameweek when currentGameweek input changes
      this.selectedGameweek = this.currentGameweek;
      if (this.selectedUser) {
        this.loadUserPredictions();
      }
    }
    if (changes['selectedUser'] && this.selectedUser) {
      // If a user is pre-selected from parent, load their predictions
      this.loadUserPredictions();
    }
    
    // Handle case where modal opens with both user and gameweek set
    if (this.isOpen && this.selectedUser && this.currentGameweek) {
      this.selectedGameweek = this.currentGameweek;
      this.loadUserPredictions();
    }
  }

  onGameweekChange(gameweek: number): void {
    this.selectedGameweek = gameweek;
    if (this.selectedUser) {
      this.loadUserPredictions();
    } else {
      // No user selected: clear displayed data for the new gameweek
      this.userPredictionData = null;
      this.error = '';
      this.loading = false;
    }
  }

  loadUserPredictions(): void {
    if (!this.selectedUser) return;

    this.loading = true;
    this.error = '';
    this.userPredictionData = null;

    const sub = this.predictionService.getOtherUserPredictions(this.selectedUser.id, this.selectedGameweek)
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
    // Local cleanup
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

}
