/* filepath: frontend/src/app/components/leaderboard/leaderboard.component.ts */
import { Component, OnInit, OnDestroy } from '@angular/core';
import { PredictionService } from '../../services/prediction.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

// Define the LeaderboardEntry interface
interface LeaderboardEntry {
  userId: number;
  username: string;
  totalPoints: number;
  totalPredictions: number;
  rank: number;
}

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss']
})
export class LeaderboardComponent implements OnInit, OnDestroy {
  leaderboard: LeaderboardEntry[] = [];
  loading = false;
  error = '';
  currentUsername = '';
  currentUserRank = 0;
  private subscription?: Subscription;

  constructor(
    private predictionService: PredictionService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Get current user info
    this.subscription = this.authService.currentUser$.subscribe(user => {
      this.currentUsername = user?.username || '';
    });
    
    this.loadLeaderboard();
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  loadLeaderboard(): void {
    this.loading = true;
    this.error = '';

    this.predictionService.getLeaderboard().subscribe({
      next: (response: any) => {
        this.loading = false;
        if (response.success) {
          this.leaderboard = response.data.map((entry: any, index: number) => ({
            userId: entry.userId,
            username: entry.username,
            totalPoints: entry.totalPoints || 0,
            totalPredictions: entry.totalPredictions || 0,
            rank: index + 1
          }));
          
          // Find current user's rank
          const currentUser = this.leaderboard.find(
            entry => entry.username === this.currentUsername
          );
          this.currentUserRank = currentUser?.rank || 0;
        }
      },
      error: (error: any) => {
        this.loading = false;
        this.error = 'Error loading leaderboard';
        console.error('Error loading leaderboard:', error);
      }
    });
  }

  getUserPosition(username: string): number {
    const user = this.leaderboard.find(entry => entry.username === username);
    return user?.rank || 0;
  }

  refreshLeaderboard(): void {
    this.loadLeaderboard();
  }

  trackByUserId(index: number, entry: LeaderboardEntry): number {
    return entry.userId;
  }
}