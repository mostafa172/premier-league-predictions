import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Router, ActivatedRoute } from "@angular/router";
import { AuthService } from "../../services/auth.service";
import { FixtureService } from "../../services/fixture.service";

@Component({
  selector: "app-fixture-form",
  templateUrl: "./fixture-form.component.html",
  styleUrls: ["./fixture-form.component.scss"],
})
export class FixtureFormComponent implements OnInit {
  fixtureForm: FormGroup;
  loading = false;
  error = "";
  success = "";
  isEditMode = false;
  fixtureId: number | null = null;
  gameweeks = Array.from({ length: 38 }, (_, i) => i + 1);

  constructor(
    private fb: FormBuilder,
    private fixtureService: FixtureService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.fixtureForm = this.fb.group({
      homeTeam: ["", [Validators.required]],
      awayTeam: ["", [Validators.required]],
      matchDate: ["", [Validators.required]],
      deadline: ["", [Validators.required]],
      gameweek: [
        "",
        [Validators.required, Validators.min(1), Validators.max(38)],
      ],
      homeScore: [""],
      awayScore: [""],
      status: ["upcoming"],
    });
  }

  ngOnInit(): void {
    // Check if user is admin
    const currentUser = this.authService.currentUserValue;
    if (!currentUser || !currentUser.isAdmin) {
      this.router.navigate(["/fixtures"]);
      return;
    }

    // Check if we're editing an existing fixture
    const id = this.route.snapshot.paramMap.get("id");
    if (id) {
      this.isEditMode = true;
      this.fixtureId = parseInt(id);
      this.loadFixture();
    }
  }

  loadFixture(): void {
    if (!this.fixtureId) return;

    this.loading = true;
    this.fixtureService.getFixtureById(this.fixtureId).subscribe({
      next: (response: any) => {
        this.loading = false;
        if (response.success) {
          const fixture = response.data;
          this.fixtureForm.patchValue({
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            matchDate: this.formatDateForInput(fixture.matchDate),
            deadline: this.formatDateForInput(fixture.deadline),
            gameweek: fixture.gameweek,
            homeScore: fixture.homeScore,
            awayScore: fixture.awayScore,
            status: fixture.status,
          });
        }
      },
      error: (error: any) => {
        this.loading = false;
        this.error = "Error loading fixture";
        console.error("Load fixture error:", error);
      },
    });
  }

  formatDateForInput(dateString: string): string {
    const date = new Date(dateString);
    // Adjust for timezone offset to display correct local time
    const localDate = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000
    );
    return localDate.toISOString().slice(0, 16); // Format for datetime-local input
  }

  onSubmit(): void {
    if (this.fixtureForm.valid) {
      this.loading = true;
      this.error = "";
      this.success = "";

      const formData = this.fixtureForm.value;
      const request = this.isEditMode
        ? this.fixtureService.updateFixture(this.fixtureId!, formData)
        : this.fixtureService.createFixture(formData);

      request.subscribe({
        next: (response: any) => {
          this.loading = false;
          if (response.success) {
            this.success = this.isEditMode
              ? "Fixture updated successfully!"
              : "Fixture created successfully!";

            // Add redirect after success
            setTimeout(() => {
              this.router.navigate(["/fixtures"]);
            }, 1500); // Show success message for 1.5 seconds before redirect
          }
        },
        error: (error: any) => {
          this.loading = false;
          this.error = error.error?.message || "Error saving fixture";
        },
      });
    }
  }

  cancel(): void {
    this.router.navigate(["/fixtures"]);
  }
}
