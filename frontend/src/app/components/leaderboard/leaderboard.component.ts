import { Component, OnInit } from '@angular/core';
import { PredictionService } from '../../services/prediction.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss']
})
export class LeaderboardComponent implements OnInit {
  leaderboard: any[] = [];
  loading = false;
  error = '';
  currentUsername = '';

  constructor(
    private predictionService: PredictionService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadLeaderboard();
    this.currentUsername = this.authService.currentUserValue?.username || '';
  }

  loadLeaderboard(): void {
    this.loading = true;
    this.error = '';
    this.predictionService.getLeaderboard().subscribe({
      next: (response: any) => {
        this.loading = false;
        if (response.success) {
          this.leaderboard = response.data;
        }
      },
      error: (error: any) => {
        this.loading = false;
        this.error = 'Error loading leaderboard';
        console.error('Error loading leaderboard:', error);
      }
    });
  }

  refreshLeaderboard(): void {
    this.loadLeaderboard();
  }
}