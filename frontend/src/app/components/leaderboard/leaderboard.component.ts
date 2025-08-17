import { Component, OnInit } from '@angular/core';
import { PredictionsService } from '../../services/predictions.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.css']
})
export class LeaderboardComponent implements OnInit {
  leaderboard: any[] = [];
  loading = true;
  error = '';
  currentUsername = ''; // Add this property

  constructor(
    private predictionsService: PredictionsService,
    public authService: AuthService, // Change from private to public
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth']);
      return;
    }
    
    // Get current username for comparison
    this.currentUsername = this.authService.currentUserValue?.username || '';
    
    this.loadLeaderboard();
  }

  loadLeaderboard(): void {
    this.loading = true;
    this.error = '';
    
    this.predictionsService.getLeaderboard().subscribe(
      (data) => {
        console.log('Leaderboard data:', data);
        this.leaderboard = data;
        this.loading = false;
      },
      (err) => {
        console.error('Error loading leaderboard:', err);
        this.error = 'Failed to load leaderboard.';
        this.loading = false;
      }
    );
  }

  refreshLeaderboard(): void {
    this.loadLeaderboard();
  }
}