import { Component, OnInit } from '@angular/core';
import { FixturesService } from '../../services/fixtures.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-fixtures',
  templateUrl: './fixtures.component.html',
  styleUrls: ['./fixtures.component.css']
})
export class FixturesComponent implements OnInit {
  fixtures: any[] = [];
  loading = true;
  error = '';
  gameweek = 1;
  gameweeks = Array.from({length: 38}, (_, i) => i + 1); // ADD THIS LINE
  isAdmin = false;

  constructor(
    private fixturesService: FixturesService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth']);
      return;
    }
    
    const currentUser = this.authService.currentUserValue;
    this.isAdmin = currentUser?.is_admin || false;
    
    this.fetchFixtures();
  }

  fetchFixtures(): void {
    this.loading = true;
    this.error = '';
    
    this.fixturesService.getFixturesByGameweek(this.gameweek).subscribe(
      (data) => {
        this.fixtures = data;
        this.loading = false;
      },
      (err) => {
        console.error('Error loading fixtures:', err);
        this.error = 'Failed to load fixtures.';
        this.loading = false;
      }
    );
  }

  onGameweekChange(newGameweek: number): void {
    this.gameweek = newGameweek;
    this.fetchFixtures();
  }

  addFixture(): void {
    this.router.navigate(['/admin/add-fixture']);
  }

  editFixture(fixture: any): void {
    this.router.navigate(['/admin/edit-fixture', fixture.id]);
  }

  deleteFixture(fixture: any): void {
    if (confirm(`Are you sure you want to delete the fixture ${fixture.homeTeam} vs ${fixture.awayTeam}?`)) {
      this.fixturesService.deleteFixture(fixture.id).subscribe(
        () => {
          this.fixtures = this.fixtures.filter(f => f.id !== fixture.id);
        },
        (err) => {
          console.error('Error deleting fixture:', err);
          this.error = 'Failed to delete fixture.';
        }
      );
    }
  }
}