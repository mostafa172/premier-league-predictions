import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Subscription } from "rxjs";
import { FixtureService } from "../../services/fixture.service";
import { AuthService } from "../../services/auth.service";

@Component({
  selector: "app-fixtures",
  templateUrl: "./fixtures.component.html",
  styleUrls: ["./fixtures.component.scss"],
})
export class FixturesComponent implements OnInit, OnDestroy {
  fixtures: any[] = [];
  gameweek = 1;
  gameweeks = Array.from({ length: 38 }, (_, i) => i + 1);
  loading = false;
  error = "";
  private initialGameweekSubscription?: Subscription;
  private fixturesLoadSubscription?: Subscription;

  constructor(
    private fixtureService: FixtureService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initialGameweekSubscription = this.fixtureService
      .getClosestGameweek()
      .subscribe({
        next: (r) => {
          if (r?.success && r.data?.gameweek)
            this.gameweek = Number(r.data.gameweek);
          this.loadFixtures();
        },
        error: () => this.loadFixtures(),
      });
  }

  ngOnDestroy(): void {
    this.initialGameweekSubscription?.unsubscribe();
    this.fixturesLoadSubscription?.unsubscribe();
  }

  loadFixtures(): void {
    this.fixturesLoadSubscription?.unsubscribe();
    const requestedGameweek = this.gameweek;
    this.loading = true;
    this.error = "";
    this.fixturesLoadSubscription = this.fixtureService
      .getFixturesByGameweek(requestedGameweek)
      .subscribe({
        next: (response: any) => {
          if (this.gameweek !== requestedGameweek) return;
          this.loading = false;
          if (response.success) {
            this.fixtures = response.data;
          }
        },
        error: (err: any) => {
          if (this.gameweek !== requestedGameweek) return;
          this.loading = false;
          this.error = "Error loading fixtures";
          console.error("Error loading fixtures:", err);
        },
      });
  }

  onGameweekChange(gameweek: number): void {
    this.initialGameweekSubscription?.unsubscribe();
    this.gameweek = gameweek;
    this.loadFixtures();
  }

  addFixture(): void {
    this.router.navigate(["/admin/fixtures"]);
  }

  editFixture(fixture: any): void {
    this.router.navigate(["/admin/fixtures", fixture.id]);
  }

  deleteFixture(fixture: any): void {
    if (
      confirm(
        `Are you sure you want to delete the fixture: ${fixture.homeTeam.name} vs ${fixture.awayTeam.name}?`
      )
    ) {
      this.fixtureService.deleteFixture(fixture.id).subscribe({
        next: (response: any) => {
          if (response.success) this.loadFixtures();
        },
        error: (err: any) => {
          console.error("Error deleting fixture:", err);
          this.error = "Error deleting fixture";
        },
      });
    }
  }

  get isAdmin(): boolean {
    return this.authService.getCurrentUser()?.isAdmin || false;
  }

  formatUTCForDatetimeLocal(isoUtc: string | Date): string {
    const d = new Date(isoUtc);
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getUTCFullYear();
    const mm = pad(d.getUTCMonth() + 1);
    const dd = pad(d.getUTCDate());
    const hh = pad(d.getUTCHours());
    const mi = pad(d.getUTCMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`; // no "Z" (datetime-local cannot take TZ)
  }

  // Takes the datetime-local value (no TZ) and makes it UTC ISO string
  datetimeLocalToUtcIso(localValue: string): string {
    // localValue is "YYYY-MM-DDTHH:mm"
    // Treat it as *UTC* and append Z
    return `${localValue}:00Z`;
  }
}
