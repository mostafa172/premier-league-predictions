import { Component, OnInit, OnDestroy } from "@angular/core";
import { FormBuilder, FormGroup, FormArray, Validators } from "@angular/forms";
import { PredictionService } from "../../services/prediction.service";
import { FixtureService } from "../../services/fixture.service";
import { catchError, forkJoin, of, Subscription } from "rxjs";
import { HeadToHead } from "../../models/head-to-head.model";

@Component({
  selector: "app-predictions",
  templateUrl: "./predictions.component.html",
  styleUrls: ["./predictions.component.scss"],
})
export class PredictionsComponent implements OnInit, OnDestroy {
  gameweek = 1;
  gameweeks = Array.from({ length: 38 }, (_, i) => i + 1);
  fixtures: any[] = [];
  predictions: any[] = [];
  existingPredictions: any[] = [];
  predictionsForm: FormGroup;
  loading = false;
  saving = false;
  error = "";
  success = "";
  message = "";
  messageType = "";
  selectedDoubleIndex = -1;
  private initialGameweekSubscription?: Subscription;
  private gameweekLoadSubscription?: Subscription;
  private formChangesSubscription?: Subscription;
  doubleLocked = false;
  hasChanges = false;

  showRules = false;

  /** Previous meetings by fixture id, loaded once per gameweek. */
  headToHead = new Map<number, HeadToHead>();
  openHeadToHead: HeadToHead | null = null;

  // Toast properties
  showToast = false;
  toastMessage = "";
  toastType = "success"; // 'success' or 'error'

  constructor(
    private fb: FormBuilder,
    private predictionService: PredictionService,
    private fixtureService: FixtureService
  ) {
    this.predictionsForm = this.fb.group({
      predictions: this.fb.array([]),
    });
  }

  ngOnInit(): void {
    this.initialGameweekSubscription = this.fixtureService
      .getClosestActiveGameweek()
      .subscribe({
        next: (r) => {
          if (r?.success && r.data?.gameweek)
            this.gameweek = Number(r.data.gameweek);
          this.loadFixturesAndPredictions();
        },
        error: () => this.loadFixturesAndPredictions(),
      });
  }

  ngOnDestroy(): void {
    this.initialGameweekSubscription?.unsubscribe();
    this.gameweekLoadSubscription?.unsubscribe();
    this.formChangesSubscription?.unsubscribe();
  }

  get predictionsArray(): FormArray {
    return this.predictionsForm.get("predictions") as FormArray;
  }

  onGameweekChange(gameweek?: number): void {
    // A manual choice wins over the initial closest-gameweek lookup, even if
    // that slower request finishes afterwards.
    this.initialGameweekSubscription?.unsubscribe();
    if (gameweek) this.gameweek = gameweek;
    this.hasChanges = false; // reset before reload
    this.loadFixturesAndPredictions();
  }

  loadFixturesAndPredictions(): void {
    // Cancel the previous gameweek's HTTP requests so late responses cannot
    // replace the currently selected gameweek's fixtures or predictions.
    this.gameweekLoadSubscription?.unsubscribe();

    const requestedGameweek = this.gameweek;
    this.loading = true;
    this.error = this.success = this.message = "";
    this.headToHead.clear();
    this.openHeadToHead = null;

    // These requests are independent. Running them together removes one full
    // backend round trip from the page's critical loading path.
    this.gameweekLoadSubscription = forkJoin({
      fixtures: this.fixtureService.getFixturesByGameweek(requestedGameweek),
      predictions:
        this.predictionService.getUserPredictionsByGameweek(requestedGameweek),
      // H2H is optional UI context, so its failure must not fail the page.
      headToHead: this.fixtureService
        .getHeadToHeadByGameweek(requestedGameweek)
        .pipe(catchError(() => of({ success: false, data: [] }))),
    }).subscribe({
      next: ({ fixtures, predictions, headToHead }: any) => {
        if (this.gameweek !== requestedGameweek) return;

        this.loading = false;
        if (!fixtures?.success || !predictions?.success) {
          this.error = this.message = "Error loading predictions";
          this.messageType = "danger";
          return;
        }

        this.fixtures = fixtures.data;
        this.predictions = predictions.data;
        this.existingPredictions = [...this.predictions];

        if (headToHead?.success) {
          (headToHead.data as HeadToHead[]).forEach((entry) => {
            entry.dots = [...entry.meetings].reverse();
            this.headToHead.set(entry.fixtureId, entry);
          });
        }

        this.doubleLocked = this.computeDoubleLock();
        this.buildPredictionsForm();
      },
      error: (err) => {
        if (this.gameweek !== requestedGameweek) return;
        this.loading = false;
        this.error = this.message = "Error loading predictions";
        this.messageType = "danger";
        console.error("Error loading gameweek:", err);
      },
    });
  }

  /** Only shown while a fixture is still open for predictions. */
  headToHeadFor(fixture: any): HeadToHead | undefined {
    if (this.isFixtureDisabled(fixture)) return undefined;
    return this.headToHead.get(fixture.id);
  }

  openH2H(fixture: any, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.openHeadToHead = this.headToHeadFor(fixture) ?? null;
  }

  closeH2H(): void {
    this.openHeadToHead = null;
  }

  /** The fixture the open modal belongs to, so it can label the two clubs. */
  get openH2HFixture(): any | undefined {
    if (!this.openHeadToHead) return undefined;
    return this.fixtures.find(
      (fixture) => fixture.id === this.openHeadToHead?.fixtureId
    );
  }

  h2hSummaryLabel(entry: HeadToHead): string {
    return (
      `Previous meetings: ` +
      `${entry.homeWins}W ${entry.draws}D ${entry.awayWins}L`
    );
  }

  buildPredictionsForm(): void {
    // Clear array
    while (this.predictionsArray.length) this.predictionsArray.removeAt(0);

    this.selectedDoubleIndex = -1;
    let foundFirstDouble = false;

    this.fixtures.forEach((fixture, index) => {
      const existing = this.predictions.find((p) => p.fixtureId === fixture.id);

      const prevHome =
        existing?.predictedHomeScore ??
        existing?.predicted_home_score ??
        existing?.homeScore ??
        null;

      const prevAway =
        existing?.predictedAwayScore ??
        existing?.predicted_away_score ??
        existing?.awayScore ??
        null;

      const prevDouble = !!(existing?.isDouble ?? existing?.is_double ?? false);

      let isDoubleInit = prevDouble;
      if (prevDouble) {
        if (!foundFirstDouble) {
          foundFirstDouble = true;
          this.selectedDoubleIndex = index;
        } else {
          isDoubleInit = false; // sanitize multiple doubles
        }
      }

      const group = this.fb.group({
        fixtureId: [fixture.id, Validators.required],
        homeScore: [prevHome, [Validators.min(0)]], // empty by default if no prediction
        awayScore: [prevAway, [Validators.min(0)]],
        isDouble: [isDoubleInit],
        predictionId: [existing?.id || null],
      });

      // Only disable double if an existing double is locked after kickoff.
      // Allow users to select double even without scores entered yet
      if (this.doubleLocked) {
        group.get("isDouble")?.disable({ emitEvent: false });
      }

      this.predictionsArray.push(group);
    });

    // reset & compute initial state
    this.hasChanges = this.computeHasChanges();

    // Rebuilding a gameweek must replace, rather than accumulate, listeners.
    this.formChangesSubscription?.unsubscribe();
    this.formChangesSubscription = this.predictionsForm.valueChanges.subscribe(
      () => {
        this.hasChanges = this.computeHasChanges();
        this.updateDoubleCheckboxStates();
      }
    );
  }

  hasExistingDouble(fixtureId: number): boolean {
    return this.existingPredictions.some(
      (p) =>
        p.fixtureId === fixtureId &&
        (p.isDouble === true || p.is_double === true)
    );
  }

  private hasPredictionChanged(index: number): boolean {
    const formGroup = this.predictionsArray.at(index);
    if (!formGroup) return false;

    const fixture = this.fixtures[index];
    const existing = this.existingPredictions.find(
      (p) => p.fixtureId === fixture.id
    );

    const currHome = formGroup.get("homeScore")?.value;
    const currAway = formGroup.get("awayScore")?.value;
    const currDouble = !!formGroup.get("isDouble")?.value;

    if (!existing) {
      // if user provided any numeric values, it's a change
      return currHome !== null || currAway !== null || currDouble === true;
    }

    const prevHome =
      existing.predictedHomeScore ??
      existing.predicted_home_score ??
      existing.homeScore ??
      null;
    const prevAway =
      existing.predictedAwayScore ??
      existing.predicted_away_score ??
      existing.awayScore ??
      null;
    const prevDouble = !!(existing.isDouble ?? existing.is_double ?? false);

    return (
      prevHome !== currHome ||
      prevAway !== currAway ||
      prevDouble !== currDouble
    );
  }

  onSubmit(): void {
    if (this.predictionsForm.valid) {
      this.saveAllPredictions();
    } else {
      this.error = this.message =
        "Please fill in all prediction fields correctly";
      this.messageType = "danger";
    }
  }

  async saveAllPredictions(): Promise<void> {
    if (!this.predictionsForm.valid) {
      this.error = this.message =
        "Please fill in all prediction fields correctly";
      this.messageType = "danger";
      return;
    }

    this.saving = true;
    this.error = this.success = this.message = "";

    const formData = this.predictionsForm.value.predictions;
    const tasks: Promise<any>[] = [];

    formData.forEach((prediction: any, index: number) => {
      if (this.isFixtureDisabled(this.fixtures[index])) return;
      if (!this.hasPredictionChanged(index)) return;

      const hasBoth =
        prediction.homeScore !== null &&
        prediction.homeScore !== undefined &&
        prediction.awayScore !== null &&
        prediction.awayScore !== undefined;

      // If no scores, skip (do not create empty prediction)
      if (!hasBoth) return;

      if (prediction.predictionId) {
        tasks.push(
          this.predictionService
            .updatePrediction(
              prediction.predictionId,
              prediction.homeScore,
              prediction.awayScore,
              prediction.isDouble
            )
            .toPromise()
        );
      } else {
        tasks.push(
          this.predictionService
            .createPrediction({
              fixtureId: prediction.fixtureId,
              homeScore: prediction.homeScore,
              awayScore: prediction.awayScore,
              isDouble: prediction.isDouble,
            })
            .toPromise()
        );
      }
    });

    if (tasks.length === 0) {
      this.saving = false;
      this.message = "No changes to save.";
      this.messageType = "info";
      this.hasChanges = false;
      return;
    }

    try {
      const results = await Promise.allSettled(tasks);
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;

      this.saving = false;

      if (failed === 0) {
        this.showToastMessage("Predictions saved successfully!", "success");
        this.success = this.message = "";
        this.messageType = "";
      } else if (succeeded > 0) {
        this.showToastMessage(
          `Saved ${succeeded} change(s). ${failed} failed (likely already started or finished).`,
          "error"
        );
        this.message = "";
        this.messageType = "";
      } else {
        this.showToastMessage("Failed to save predictions.", "error");
        this.error = this.message = "";
        this.messageType = "";
      }

      this.hasChanges = false; // reset after successful attempt
      this.loadFixturesAndPredictions();
    } catch (e) {
      this.saving = false;
      this.error = this.message = "Error saving predictions";
      this.messageType = "danger";
      console.error("Error saving predictions:", e);
    }
  }

  onDoubleChange(index: number): void {
    const group = this.predictionsArray.at(index);
    if (!group) return;

    const current = !!group.get("isDouble")?.value;
    if (current) {
      if (
        this.selectedDoubleIndex !== -1 &&
        this.selectedDoubleIndex !== index
      ) {
        this.predictionsArray
          .at(this.selectedDoubleIndex)
          ?.get("isDouble")
          ?.setValue(false);
      }
      this.selectedDoubleIndex = index;
    } else {
      this.selectedDoubleIndex = -1;
    }

    this.hasChanges = this.computeHasChanges();
  }

  private updateDoubleCheckboxStates(): void {
    // Update double checkbox states based on current form values
    this.predictionsArray.controls.forEach((group, index) => {
      const isDoubleControl = group.get("isDouble");
      if (!isDoubleControl || this.doubleLocked) return;

      const homeScore = group.get("homeScore")?.value;
      const awayScore = group.get("awayScore")?.value;
      const hasValidScores =
        homeScore !== null &&
        homeScore !== undefined &&
        awayScore !== null &&
        awayScore !== undefined &&
        homeScore >= 0 &&
        awayScore >= 0;

      // If user has selected double but doesn't have valid scores, keep it enabled
      // The validation will happen on submit
      if (isDoubleControl.value === true) {
        isDoubleControl.enable({ emitEvent: false });
      }
    });
  }

  isFixtureDisabled(fixture: any): boolean {
    const matchDate = new Date(fixture.matchDate);
    const now = new Date();
    return (
      now >= matchDate ||
      fixture.status === "finished" ||
      fixture.status === "live"
    );
  }

  hasSubmittedPrediction(fixture: any): boolean {
    const existing = this.existingPredictions.find(
      (p) => p.fixtureId === fixture.id
    );
    if (!existing) return false;

    const home =
      existing.predictedHomeScore ?? existing.predicted_home_score ?? null;
    const away =
      existing.predictedAwayScore ?? existing.predicted_away_score ?? null;

    return home !== null && away !== null;
  }

  // Double was applied and the fixture can no longer be edited.
  isDoubleLockedIn(fixture: any): boolean {
    return (
      this.isFixtureDisabled(fixture) && this.hasExistingDouble(fixture.id)
    );
  }

  // Deadline has passed (live/finished) and no prediction was ever submitted.
  isMissedPrediction(fixture: any): boolean {
    return (
      this.isFixtureDisabled(fixture) && !this.hasSubmittedPrediction(fixture)
    );
  }

  hasValidPrediction(index: number): boolean {
    const group = this.predictionsArray.at(index);
    if (!group) return false;
    const h = group.get("homeScore")?.value;
    const a = group.get("awayScore")?.value;
    return (
      h !== null &&
      h !== undefined &&
      a !== null &&
      a !== undefined &&
      h >= 0 &&
      a >= 0
    );
  }

  getPredictionPoints(fixture: any): number {
    const prediction = this.predictions.find((p) => p.fixtureId === fixture.id);
    return prediction?.points || 0;
  }

  getGameweekTotalPoints(): number {
    return this.predictions.reduce((total, prediction) => {
      return total + (prediction.points || 0);
    }, 0);
  }

  trackByFixtureId(index: number, fixture: any): number {
    return fixture.id;
  }

  getFormattedDate(date: string): string {
    // Force JS to treat as UTC then convert to local
    const utcDate = new Date(date);
    const localDate = new Date(
      utcDate.getUTCFullYear(),
      utcDate.getUTCMonth(),
      utcDate.getUTCDate(),
      utcDate.getUTCHours(),
      utcDate.getUTCMinutes(),
      utcDate.getUTCSeconds()
    );

    return localDate.toLocaleString([], {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private computeDoubleLock(): boolean {
    const now = new Date();
    return this.existingPredictions.some((p) => {
      if (!p.isDouble && !p.is_double) return false;
      const fx = this.fixtures.find((f) => f.id === p.fixtureId);
      if (!fx) return false;
      return now >= new Date(fx.matchDate) || fx.status !== "upcoming";
    });
  }

  private computeHasChanges(): boolean {
    // loop through fixtures, reuse your existing "hasPredictionChanged" logic
    for (let i = 0; i < this.fixtures.length; i++) {
      // skip disabled fixtures
      if (this.isFixtureDisabled(this.fixtures[i])) continue;

      // require both scores to be set before we consider it a change worth saving
      const fg = this.predictionsArray.at(i);
      const h = fg?.get("homeScore")?.value;
      const a = fg?.get("awayScore")?.value;
      const hasBoth =
        h !== null && h !== undefined && a !== null && a !== undefined;

      if (hasBoth && this.hasPredictionChanged(i)) {
        return true;
      }
    }
    return false;
  }

  showToastMessage(message: string, type: "success" | "error"): void {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;

    // Auto-hide toast after 3 seconds
    setTimeout(() => {
      this.showToast = false;
    }, 3000);
  }
}
