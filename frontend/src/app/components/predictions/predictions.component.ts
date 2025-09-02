import { Component, OnInit, OnDestroy } from "@angular/core";
import { FormBuilder, FormGroup, FormArray, Validators } from "@angular/forms";
import { PredictionService } from "../../services/prediction.service";
import { FixtureService } from "../../services/fixture.service";
import { Subscription } from "rxjs";

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
  private subscriptions: Subscription[] = [];
  doubleLocked = false;
  hasChanges = false;

  showRules = false;

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
    this.fixtureService.getClosestGameweek().subscribe({
      next: (r) => {
        if (r?.success && r.data?.gameweek)
          this.gameweek = Number(r.data.gameweek);
        this.loadFixturesAndPredictions();
      },
      error: () => this.loadFixturesAndPredictions(),
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  get predictionsArray(): FormArray {
    return this.predictionsForm.get("predictions") as FormArray;
  }

  onGameweekChange(gameweek?: number): void {
    if (gameweek) this.gameweek = gameweek;
    this.hasChanges = false; // reset before reload
    this.loadFixturesAndPredictions();
  }

  loadFixturesAndPredictions(): void {
    this.loading = true;
    this.error = this.success = this.message = "";

    const fixturesSub = this.fixtureService
      .getFixturesByGameweek(this.gameweek)
      .subscribe({
        next: (fixturesResponse: any) => {
          if (fixturesResponse.success) {
            this.fixtures = fixturesResponse.data;

            const predictionsSub = this.predictionService
              .getUserPredictionsByGameweek(this.gameweek)
              .subscribe({
                next: (predictionsResponse: any) => {
                  this.loading = false;
                  if (predictionsResponse.success) {
                    this.predictions = predictionsResponse.data;
                    this.existingPredictions = [...this.predictions];
                    this.doubleLocked = this.computeDoubleLock();
                    this.buildPredictionsForm();
                  }
                },
                error: (err) => {
                  this.loading = false;
                  this.error = this.message = "Error loading predictions";
                  this.messageType = "danger";
                  console.error("Error loading predictions:", err);
                },
              });

            this.subscriptions.push(predictionsSub);
          }
        },
        error: (err) => {
          this.loading = false;
          this.error = this.message = "Error loading fixtures";
          this.messageType = "danger";
          console.error("Error loading fixtures:", err);
        },
      });

    this.subscriptions.push(fixturesSub);
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

      const hasValues =
        prevHome !== null &&
        prevHome !== undefined &&
        prevAway !== null &&
        prevAway !== undefined &&
        prevHome >= 0 &&
        prevAway >= 0;

      if (this.doubleLocked || !hasValues) {
        group.get("isDouble")?.disable({ emitEvent: false });
      }

      this.predictionsArray.push(group);
    });

    // reset & compute initial state
    this.hasChanges = this.computeHasChanges();

    // subscribe once per rebuild
    // (unsubscribe isn’t needed because the whole form is rebuilt between gameweeks)
    this.predictionsForm.valueChanges.subscribe(() => {
      this.hasChanges = this.computeHasChanges();
    });
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
        this.success = this.message = "Predictions saved successfully!";
        this.messageType = "success";
      } else if (succeeded > 0) {
        this.message = `Saved ${succeeded} change(s). ${failed} failed (likely past deadline or finished).`;
        this.messageType = "warning";
      } else {
        this.error = this.message = "Failed to save predictions.";
        this.messageType = "danger";
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

  isFixtureDisabled(fixture: any): boolean {
    const deadline = new Date(fixture.deadline);
    const now = new Date();
    return (
      now >= deadline ||
      fixture.status === "finished" ||
      fixture.status === "live"
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

  getFormattedDeadline(deadline: string): string {
    const utcDate = new Date(deadline);
    const localDate = new Date(
      utcDate.getUTCFullYear(),
      utcDate.getUTCMonth(),
      utcDate.getUTCDate(),
      utcDate.getUTCHours(),
      utcDate.getUTCMinutes(),
      utcDate.getUTCSeconds()
    );

    const now = new Date();
    const diffInMinutes = Math.floor(
      (localDate.getTime() - now.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 0) return "Deadline passed";
    if (diffInMinutes < 60) return `${diffInMinutes} minutes left`;
    if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? "s" : ""} left`;
    }
    const days = Math.floor(diffInMinutes / 1440);
    return `${days} day${days > 1 ? "s" : ""} left`;
  }

  private computeDoubleLock(): boolean {
    const now = new Date();
    return this.existingPredictions.some((p) => {
      if (!p.isDouble && !p.is_double) return false;
      const fx = this.fixtures.find((f) => f.id === p.fixtureId);
      if (!fx) return false;
      return now >= new Date(fx.deadline) || fx.status !== "upcoming";
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
}
