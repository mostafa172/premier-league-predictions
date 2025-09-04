import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { LeagueService } from '../../services/league.service';
import { LeagueDetails, LeagueMember } from '../../models/league.model';

@Component({
  selector: 'app-league-detail',
  templateUrl: './league-detail.component.html',
  styleUrls: ['./league-detail.component.scss']
})
export class LeagueDetailComponent implements OnInit, OnDestroy {
  leagueId: number | null = null;
  leagueDetails: LeagueDetails | null = null;
  loading = false;
  error = '';
  showLeaveModal = false;
  showSuccessModal = false;
  successMessage = '';
  
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private leagueService: LeagueService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.leagueId = parseInt(params['id']);
      if (this.leagueId) {
        this.loadLeagueDetails();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadLeagueDetails(): void {
    if (!this.leagueId) return;

    this.loading = true;
    this.error = '';

    const sub = this.leagueService.getLeagueDetails(this.leagueId).subscribe({
      next: (response) => {
        if (response.success) {
          this.leagueDetails = response.data;
        } else {
          this.error = response.message || 'Failed to load league details';
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading league details:', error);
        this.error = 'Error loading league details';
        this.loading = false;
      }
    });

    this.subscriptions.push(sub);
  }

  copyJoinCode(joinCode: string): void {
    navigator.clipboard.writeText(joinCode).then(() => {
      // Show a simple alert for now (you can replace with a proper toast later)
      alert('League code copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy join code:', err);
      alert('Failed to copy league code');
    });
  }

  openLeaveModal(): void {
    this.showLeaveModal = true;
  }

  closeLeaveModal(): void {
    this.showLeaveModal = false;
  }

  leaveLeague(): void {
    if (!this.leagueId) return;

    this.loading = true;
    this.error = '';

    const sub = this.leagueService.leaveLeague(this.leagueId).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = 'You have successfully left the league!';
          this.showSuccessModal = true;
          this.closeLeaveModal();
          // Navigate back to leagues page after a short delay
          setTimeout(() => {
            this.router.navigate(['/leagues']);
          }, 2000);
        } else {
          this.error = response.message || 'Failed to leave league';
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error leaving league:', error);
        this.error = 'Error leaving league';
        this.loading = false;
      }
    });

    this.subscriptions.push(sub);
  }

  goBack(): void {
    this.router.navigate(['/leagues']);
  }

  refreshData(): void {
    this.loadLeagueDetails();
  }

  get isCreator(): boolean {
    return this.leagueDetails?.league.isCreator || false;
  }

  get sortedMembers(): LeagueMember[] {
    if (!this.leagueDetails?.members) return [];
    
    return [...this.leagueDetails.members].sort((a, b) => {
      // Creator always first
      if (a.isCreator && !b.isCreator) return -1;
      if (!a.isCreator && b.isCreator) return 1;
      
      // Then by points (descending)
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      
      // Finally by username (ascending)
      return a.username.localeCompare(b.username);
    });
  }

  closeSuccessModal(): void {
    this.showSuccessModal = false;
    this.successMessage = '';
  }
}
