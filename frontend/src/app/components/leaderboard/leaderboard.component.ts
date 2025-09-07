/* filepath: frontend/src/app/components/leaderboard/leaderboard.component.ts */
import { Component, OnInit, OnDestroy } from '@angular/core';
import { PredictionService } from '../../services/prediction.service';
import { AuthService } from '../../services/auth.service';
import { FixtureService } from '../../services/fixture.service';
import { Subscription } from 'rxjs';
import { User } from '../../models/user.model';

// Define the LeaderboardEntry interface
interface LeaderboardEntry {
  userId: number;
  username: string;
  totalPoints: number;
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
  
  // User predictions modal properties
  showUserPredictionsModal = false;
  selectedUser: User | null = null;
  allUsers: User[] = [];
  currentGameweek = 1;

  constructor(
    private predictionService: PredictionService,
    private authService: AuthService,
    private fixtureService: FixtureService
  ) {}

  ngOnInit(): void {
    // Get current user info
    this.subscription = this.authService.currentUser$.subscribe(user => {
      this.currentUsername = user?.username || '';
    });
    
    this.loadLeaderboard();
    this.loadAllUsers();
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

  loadAllUsers(): void {
    this.predictionService.getLeaderboard().subscribe({
      next: (response) => {
        if (response.success) {
          this.allUsers = response.data.map((entry: any) => ({
            id: entry.userId,
            username: entry.username
          }));
        }
      },
      error: (error) => {
        console.error('Error loading users:', error);
      }
    });
  }

  onUserClick(entry: LeaderboardEntry): void {
    // Don't open modal for current user
    if (entry.username === this.currentUsername) {
      return;
    }

    // Find the user in allUsers array
    this.selectedUser = this.allUsers.find(user => user.id === entry.userId) || null;
    
    if (this.selectedUser) {
      // Get the closest gameweek before opening the modal
      this.fixtureService.getClosestGameweek().subscribe({
        next: (response) => {
          if (response?.success && response.data?.gameweek) {
            this.currentGameweek = Number(response.data.gameweek);
          }
          this.showUserPredictionsModal = true;
        },
        error: () => {
          // If getting closest gameweek fails, still open modal with current gameweek
          this.showUserPredictionsModal = true;
        }
      });
    }
  }

  closeUserPredictionsModal(): void {
    this.showUserPredictionsModal = false;
    this.selectedUser = null;
  }
}