import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { PredictionService } from '../../services/prediction.service';
import { Subscription } from 'rxjs';

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
export class UserPredictionsModalComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Input() currentGameweek = 1;
  @Input() users: User[] = [];

  selectedUserId: number | null = null;
  selectedGameweek = 1;
  userPredictionData: UserPredictionData | null = null;
  loading = false;
  error = '';
  private subscriptions: Subscription[] = [];

  constructor(private predictionService: PredictionService) {}

  ngOnInit(): void {
    this.selectedGameweek = this.currentGameweek;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onUserSelect(userId: number | null): void {
    if (!userId) return;
    this.selectedUserId = userId;
    this.loadUserPredictions();
  }

  onGameweekChange(gameweek: number): void {
    this.selectedGameweek = gameweek;
    if (this.selectedUserId) {
      this.loadUserPredictions();
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
    this.isOpen = false;
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
}
