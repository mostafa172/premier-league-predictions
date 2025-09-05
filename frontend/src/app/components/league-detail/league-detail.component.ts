import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { LeagueService } from '../../services/league.service';
import { LeagueDetails, LeagueMember } from '../../models/league.model';
import { FixtureService } from '../../services/fixture.service';
import { User } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';

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
  
  // User predictions modal properties
  showUserPredictionsModal = false;
  selectedUser: User | null = null;
  allUsers: User[] = [];
  currentGameweek: number = 1;
  currentUserId: number | null = null;
  
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private leagueService: LeagueService,
    private fixtureService: FixtureService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Get current user ID
    const currentUser = this.authService.getCurrentUser();
    this.currentUserId = currentUser?.id || null;

    this.route.params.subscribe(params => {
      this.leagueId = parseInt(params['id']);
      if (this.leagueId) {
        this.loadLeagueDetails();
        this.loadAllUsers();
        this.loadCurrentGameweek();
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
          this.loadAllUsers(); // Load users after league details are loaded
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

  loadAllUsers(): void {
    // Convert league members to User objects for the modal
    if (this.leagueDetails?.members) {
      this.allUsers = this.leagueDetails.members.map(member => ({
        id: member.id,
        username: member.username,
        email: '', // Not needed for the modal
        totalPoints: member.totalPoints,
        createdAt: member.joinedAt,
        isAdmin: false // Not needed for the modal
      }));
    }
  }

  loadCurrentGameweek(): void {
    const sub = this.fixtureService.getClosestGameweek().subscribe({
      next: (gameweek) => {
        this.currentGameweek = gameweek;
      },
      error: (error) => {
        console.error('Error loading current gameweek:', error);
        this.currentGameweek = 1; // fallback
      }
    });
    this.subscriptions.push(sub);
  }

  onUserClick(member: LeagueMember): void {
    // Don't allow clicking on current user
    if (member.id === this.currentUserId) {
      return;
    }

    // Find the user in allUsers array
    this.selectedUser = this.allUsers.find(user => user.id === member.id) || null;
    
    if (this.selectedUser) {
      // Get the closest gameweek before opening the modal (like leaderboard component)
      this.fixtureService.getClosestGameweek().subscribe({
        next: (response) => {
          if (response?.success && response.data?.gameweek) {
            this.currentGameweek = Number(response.data.gameweek);
          }
          // Small delay to ensure the modal processes the input changes
          setTimeout(() => {
            this.showUserPredictionsModal = true;
          }, 50);
        },
        error: () => {
          // If getting closest gameweek fails, still open modal with current gameweek
          setTimeout(() => {
            this.showUserPredictionsModal = true;
          }, 50);
        }
      });
    }
  }

  closeUserPredictionsModal(): void {
    this.showUserPredictionsModal = false;
    this.selectedUser = null;
  }

  isCurrentUser(member: LeagueMember): boolean {
    return member.id === this.currentUserId;
  }
}
