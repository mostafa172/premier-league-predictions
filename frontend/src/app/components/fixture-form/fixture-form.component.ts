/* filepath: frontend/src/app/components/fixture-form/fixture-form.component.ts */
import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Router, ActivatedRoute } from "@angular/router";
import { TeamService } from "../../services/team.service";
import { FixtureService } from "../../services/fixture.service";
import { Team } from "../../models/team.model";

@Component({
  selector: "app-fixture-form",
  templateUrl: "./fixture-form.component.html",
  styleUrls: ["./fixture-form.component.scss"],
})
export class FixtureFormComponent implements OnInit {
  fixtureForm: FormGroup;
  teams: Team[] = [];
  gameweeks = Array.from({ length: 38 }, (_, i) => i + 1);
  loading = false;
  isEdit = false;
  fixtureId?: number;

  constructor(
    private fb: FormBuilder,
    private teamService: TeamService,
    private fixtureService: FixtureService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.fixtureForm = this.fb.group({
      homeTeamId: ["", [Validators.required]],
      awayTeamId: ["", [Validators.required]],
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
    this.loadTeams();

    // Check if we're editing
    const id = this.route.snapshot.params["id"];
    if (id) {
      this.isEdit = true;
      this.fixtureId = parseInt(id);
      this.loadFixture(this.fixtureId);
    }
  }

  loadTeams(): void {
    this.teamService.getAllTeams().subscribe({
      next: (response) => {
        if (response.success) {
          this.teams = response.data;
        }
      },
      error: (error) => {
        console.error("Error loading teams:", error);
      },
    });
  }

  loadFixture(id: number): void {
    this.fixtureService.getFixtureById(id).subscribe({
      next: (response) => {
        if (response.success) {
          const fixture = response.data;
          this.fixtureForm.patchValue({
            homeTeamId: fixture.homeTeamId,
            awayTeamId: fixture.awayTeamId,
            matchDate: this.formatDateTimeLocal(fixture.matchDate),
            deadline: this.formatDateTimeLocal(fixture.deadline),
            gameweek: fixture.gameweek,
            homeScore: fixture.homeScore,
            awayScore: fixture.awayScore,
            status: fixture.status,
          });
        }
      },
      error: (error) => {
        console.error("Error loading fixture:", error);
      },
    });
  }

  private pad(n: number): string {
    return n.toString().padStart(2, "0");
  }

  /** Format a Date or ISO string into 'YYYY-MM-DDTHH:mm' in the user's local time */
  formatDateTimeLocal(date: Date | string): string {
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = this.pad(d.getMonth() + 1);
    const dd = this.pad(d.getDate());
    const hh = this.pad(d.getHours());
    const mi = this.pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  getTeamById(id: number): Team | undefined {
    return this.teams.find((team) => team.id === id);
  }

  onSubmit(): void {
    if (this.fixtureForm.valid) {
      const formData = this.fixtureForm.value;

      // Validate different teams
      if (formData.homeTeamId === formData.awayTeamId) {
        alert("Home and away teams must be different");
        return;
      }

      this.loading = true;

      const operation = this.isEdit
        ? this.fixtureService.updateFixture(this.fixtureId!, formData)
        : this.fixtureService.createFixture(formData);

      operation.subscribe({
        next: (response) => {
          console.log(
            `Fixture ${this.isEdit ? "updated" : "created"} successfully`
          );
          this.router.navigate(["/fixtures"]);
        },
        error: (error) => {
          console.error(
            `Error ${this.isEdit ? "updating" : "creating"} fixture:`,
            error
          );
          this.loading = false;
        },
      });
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.fixtureForm.controls).forEach((key) => {
        this.fixtureForm.get(key)?.markAsTouched();
      });
    }
  }

  cancel(): void {
    this.router.navigate(["/fixtures"]);
  }

  // Validation helper methods
  isFieldInvalid(fieldName: string): boolean {
    const field = this.fixtureForm.get(fieldName);
    return field ? field.invalid && (field.dirty || field.touched) : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.fixtureForm.get(fieldName);
    if (field?.errors) {
      if (field.errors["required"]) return `${fieldName} is required`;
      if (field.errors["min"])
        return `${fieldName} must be at least ${field.errors["min"].min}`;
      if (field.errors["max"])
        return `${fieldName} must be at most ${field.errors["max"].max}`;
    }
    return "";
  }
}
