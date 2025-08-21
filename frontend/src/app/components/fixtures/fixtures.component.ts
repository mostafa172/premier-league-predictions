import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FixtureService } from '../../services/fixture.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-fixtures',
  templateUrl: './fixtures.component.html',
  styleUrls: ['./fixtures.component.scss']
})
export class FixturesComponent implements OnInit {
  fixtures: any[] = [];
  gameweek = 1;
  gameweeks = Array.from({ length: 38 }, (_, i) => i + 1);
  loading = false;
  error = '';
  isAdmin = false;

  constructor(
    private fixtureService: FixtureService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadFixtures();
    
    // Check if user is admin
    const currentUser = this.authService.currentUserValue;
    this.isAdmin = currentUser?.isAdmin || false;
  }

  loadFixtures(): void {
    this.loading = true;
    this.error = '';
    this.fixtureService.getFixturesByGameweek(this.gameweek).subscribe({
      next: (response: any) => {
        this.loading = false;
        if (response.success) {
          this.fixtures = response.data;
        }
      },
      error: (error: any) => {
        this.loading = false;
        this.error = 'Error loading fixtures';
        console.error('Error loading fixtures:', error);
      }
    });
  }

  onGameweekChange(gameweek: number): void {
    this.gameweek = gameweek;
    this.loadFixtures();
  }

  addFixture(): void {
    this.router.navigate(['/admin/fixtures']);
  }

  editFixture(fixture: any): void {
    this.router.navigate(['/admin/fixtures', fixture.id]);
  }

  deleteFixture(fixture: any): void {
    if (confirm(`Are you sure you want to delete the fixture ${fixture.homeTeam} vs ${fixture.awayTeam}?`)) {
      this.fixtureService.deleteFixture(fixture.id).subscribe({
        next: (response: any) => {
          if (response.success) {
            this.loadFixtures(); // Reload the fixtures
          }
        },
        error: (error: any) => {
          this.error = error.error?.message || 'Error deleting fixture';
          console.error('Delete fixture error:', error);
        }
      });
    }
  }
}