import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { FixturesService } from '../../services/fixtures.service';
import { AuthService } from '../../services/auth.service';
import { CreateFixtureRequest, UpdateFixtureRequest } from '../../models/fixture.model';

@Component({
  selector: 'app-fixture-form',
  templateUrl: './fixture-form.component.html',
  styleUrls: ['./fixture-form.component.css']
})
export class FixtureFormComponent implements OnInit {
  fixtureForm: FormGroup;
  loading = false;
  error = '';
  success = '';
  isEditMode = false;
  fixtureId: number | null = null;
  gameweeks = Array.from({length: 38}, (_, i) => i + 1); // ADD THIS LINE

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private fixturesService: FixturesService,
    private authService: AuthService
  ) {
    this.fixtureForm = this.fb.group({
      homeTeam: ['', [Validators.required]],
      awayTeam: ['', [Validators.required]],
      matchDate: ['', [Validators.required]],
      deadline: ['', [Validators.required]],
      gameweek: [1, [Validators.required, Validators.min(1), Validators.max(38)]],
      homeScore: [null],
      awayScore: [null],
      status: ['upcoming']
    });
  }

  ngOnInit(): void {
    // Check if user is admin
    const currentUser = this.authService.currentUserValue;
    if (!currentUser || !currentUser.is_admin) {
      this.router.navigate(['/fixtures']);
      return;
    }

    // Check if we're in edit mode
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.fixtureId = parseInt(params['id']);
        this.loadFixture(this.fixtureId);
      }
    });
  }

  loadFixture(id: number): void {
    this.fixturesService.getFixtureById(id).subscribe(
      (fixture) => {
        const matchDate = new Date(fixture.matchDate);
        const deadline = new Date(fixture.deadline);
        
        const matchDateLocal = new Date(matchDate.getTime() - (matchDate.getTimezoneOffset() * 60000));
        const deadlineLocal = new Date(deadline.getTime() - (deadline.getTimezoneOffset() * 60000));
        
        this.fixtureForm.patchValue({
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          matchDate: matchDateLocal.toISOString().slice(0, 16),
          deadline: deadlineLocal.toISOString().slice(0, 16),
          gameweek: fixture.gameweek,
          homeScore: fixture.homeScore,
          awayScore: fixture.awayScore,
          status: fixture.status
        });
      },
      (err) => {
        this.error = 'Failed to load fixture';
        console.error('Error loading fixture:', err);
      }
    );
  }

  onSubmit(): void {
    if (this.fixtureForm.valid) {
      this.loading = true;
      this.error = '';

      const formData = this.fixtureForm.value;
      
      if (this.isEditMode) {
        const updateData: UpdateFixtureRequest = {
          homeTeam: formData.homeTeam,
          awayTeam: formData.awayTeam,
          matchDate: formData.matchDate,
          deadline: formData.deadline,
          gameweek: formData.gameweek,
          homeScore: formData.homeScore,
          awayScore: formData.awayScore,
          status: formData.status
        };

        this.fixturesService.updateFixture(this.fixtureId!, updateData).subscribe(
          () => {
            this.success = 'Fixture updated successfully!';
            this.loading = false;
            setTimeout(() => {
              this.router.navigate(['/fixtures']);
            }, 2000);
          },
          (err) => {
            this.error = 'Failed to update fixture';
            this.loading = false;
            console.error('Error updating fixture:', err);
          }
        );
      } else {
        const createData: CreateFixtureRequest = {
          homeTeam: formData.homeTeam,
          awayTeam: formData.awayTeam,
          matchDate: formData.matchDate,
          deadline: formData.deadline,
          gameweek: formData.gameweek
        };

        this.fixturesService.createFixture(createData).subscribe(
          () => {
            this.success = 'Fixture created successfully!';
            this.loading = false;
            setTimeout(() => {
              this.router.navigate(['/fixtures']);
            }, 2000);
          },
          (err) => {
            this.error = 'Failed to create fixture';
            this.loading = false;
            console.error('Error creating fixture:', err);
          }
        );
      }
    }
  }

  cancel(): void {
    this.router.navigate(['/fixtures']);
  }
}