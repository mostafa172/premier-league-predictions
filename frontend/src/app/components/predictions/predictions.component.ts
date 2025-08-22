/* filepath: frontend/src/app/components/predictions/predictions.component.ts */
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
    this.loadFixturesAndPredictions();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  get predictionsArray(): FormArray {
    return this.predictionsForm.get("predictions") as FormArray;
  }

  onGameweekChange(gameweek?: number): void {
    if (gameweek) {
      this.gameweek = gameweek;
    }
    this.loadFixturesAndPredictions();
  }

  loadFixturesAndPredictions(): void {
    this.loading = true;
    this.error = "";
    this.success = "";
    this.message = "";

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
                error: (error: any) => {
                  this.loading = false;
                  this.error = "Error loading predictions";
                  this.message = "Error loading predictions";
                  this.messageType = "danger";
                  console.error("Error loading predictions:", error);
                },
              });
            this.subscriptions.push(predictionsSub);
          }
        },
        error: (error: any) => {
          this.loading = false;
          this.error = "Error loading fixtures";
          this.message = "Error loading fixtures";
          this.messageType = "danger";
          console.error("Error loading fixtures:", error);
        },
      });
    this.subscriptions.push(fixturesSub);
  }

  buildPredictionsForm(): void {
    // 0) Clear existing form array
    while (this.predictionsArray.length) {
      this.predictionsArray.removeAt(0);
    }

    // 1) Reset state
    this.selectedDoubleIndex = -1;

    // 2) Figure out if GW double is locked (if you didn’t compute earlier)
    // If you already called this.doubleLocked = this.computeDoubleLock(); before this method,
    // you can keep this guard; otherwise uncomment the next line:
    // this.doubleLocked = this.computeDoubleLock();

    // 3) Build rows
    let foundFirstDouble = false;

    this.fixtures.forEach((fixture, index) => {
      const existing = this.predictions.find((p) => p.fixtureId === fixture.id);

      // Resolve existing values (API may send snake_case)
      const prevHome =
        existing?.predictedHomeScore ??
        existing?.predicted_home_score ??
        existing?.homeScore ??
        0;

      const prevAway =
        existing?.predictedAwayScore ??
        existing?.predicted_away_score ??
        existing?.awayScore ??
        0;

      const prevDouble = !!(existing?.isDouble ?? existing?.is_double ?? false);

      // Track which one is currently double (first one wins if multiple)
      let isDoubleInit = prevDouble;
      if (prevDouble) {
        if (!foundFirstDouble) {
          foundFirstDouble = true;
          this.selectedDoubleIndex = index;
        } else {
          // sanitize accidental multiple doubles from old state
          isDoubleInit = false;
        }
      }

      const group = this.fb.group({
        fixtureId: [fixture.id, Validators.required],
        homeScore: [prevHome, [Validators.required, Validators.min(0)]],
        awayScore: [prevAway, [Validators.required, Validators.min(0)]],
        isDouble: [isDoubleInit],
        predictionId: [existing?.id || null],
      });

      // Disable isDouble if:
      // - the GW double is locked, or
      // - the row has no valid prediction yet (matches your existing UX)
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

    // 4) Final sanity: if lock is active but none marked double in form,
    // just keep controls disabled; backend will still enforce the rule.
    // (Nothing else needed here.)

    // Debug logs (optional)
    // console.log('Built form with selectedDoubleIndex:', this.selectedDoubleIndex);
    // console.log('doubleLocked:', this.doubleLocked);
    // console.log('Form values:', this.predictionsForm.value);
  }

  debugPredictionPoints(fixture: any): void {
    const prediction = this.predictions.find((p) => p.fixtureId === fixture.id);

    console.log("Debug prediction points:", {
      fixture: {
        id: fixture.id,
        homeTeam: fixture.homeTeam?.name,
        awayTeam: fixture.awayTeam?.name,
        status: fixture.status,
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
      },
      prediction: prediction
        ? {
            id: prediction.id,
            predictedHomeScore: prediction.predictedHomeScore,
            predictedAwayScore: prediction.predictedAwayScore,
            points: prediction.points,
            isDouble: prediction.isDouble,
          }
        : "No prediction found",
    });
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
      // no previous prediction — any valid value means change
      return true;
    }

    const prevHome =
      existing.predictedHomeScore ??
      existing.predicted_home_score ??
      existing.homeScore ??
      0;
    const prevAway =
      existing.predictedAwayScore ??
      existing.predicted_away_score ??
      existing.awayScore ??
      0;
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
      this.error = "Please fill in all prediction fields correctly";
      this.message = "Please fill in all prediction fields correctly";
      this.messageType = "danger";
    }
  }

  async saveAllPredictions(): Promise<void> {
    if (!this.predictionsForm.valid) {
      this.error = "Please fill in all prediction fields correctly";
      this.message = this.error;
      this.messageType = "danger";
      return;
    }

    this.saving = true;
    this.error = "";
    this.success = "";
    this.message = "";

    const formData = this.predictionsForm.value.predictions;

    // Build tasks only for editable + changed rows
    const tasks: Promise<any>[] = [];

    formData.forEach((prediction: any, index: number) => {
      // 1) Skip fixtures you cannot edit
      if (this.isFixtureDisabled(this.fixtures[index])) return;

      // 2) Skip if nothing changed
      if (!this.hasPredictionChanged(index)) return;

      // 3) Queue request
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
      return;
    }

    try {
      const results = await Promise.allSettled(tasks);

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;

      this.saving = false;

      if (failed === 0) {
        this.success = "Predictions saved successfully!";
        this.message = this.success;
        this.messageType = "success";
      } else if (succeeded > 0) {
        this.message = `Saved ${succeeded} change(s). ${failed} failed (likely past deadline or finished).`;
        this.messageType = "warning";
      } else {
        this.error = "Failed to save predictions.";
        this.message = this.error;
        this.messageType = "danger";
      }

      // Refresh to reflect server state
      this.loadFixturesAndPredictions();
    } catch (e) {
      this.saving = false;
      this.error = "Error saving predictions";
      this.message = this.error;
      this.messageType = "danger";
      console.error("Error saving predictions:", e);
    }
  }

  onDoubleChange(index: number): void {
    console.log("Double change called for index:", index);

    const currentGroup = this.predictionsArray.at(index);
    if (!currentGroup) return;

    const isDoubleControl = currentGroup.get("isDouble");
    const currentValue = isDoubleControl?.value;

    console.log("Current double value:", currentValue);

    // If this prediction is being checked
    if (currentValue) {
      // Only allow one double per gameweek - uncheck previous
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
      // Being unchecked
      this.selectedDoubleIndex = -1;
    }

    console.log("Updated selectedDoubleIndex:", this.selectedDoubleIndex);
    console.log("Form values after change:", this.predictionsForm.value);
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
    const predictionGroup = this.predictionsArray.at(index);
    if (!predictionGroup) return false;

    const homeScore = predictionGroup.get("homeScore")?.value;
    const awayScore = predictionGroup.get("awayScore")?.value;

    return (
      homeScore !== null &&
      homeScore !== undefined &&
      awayScore !== null &&
      awayScore !== undefined &&
      homeScore >= 0 &&
      awayScore >= 0
    );
  }

  clearPredictions(): void {
    this.clearAllPredictions();
  }

  clearAllPredictions(): void {
    if (
      confirm(
        "Are you sure you want to clear all predictions for this gameweek?"
      )
    ) {
      this.predictionsArray.controls.forEach((control) => {
        control.get("homeScore")?.setValue(0);
        control.get("awayScore")?.setValue(0);
        control.get("isDouble")?.setValue(false);
      });
      this.selectedDoubleIndex = -1;
      this.success = "";
      this.error = "";
      this.message = "";
    }
  }

  getPredictionsCount(): number {
    let count = 0;
    this.predictionsArray.controls.forEach((control) => {
      const homeScore = control.get("homeScore")?.value;
      const awayScore = control.get("awayScore")?.value;
      if (homeScore >= 0 && awayScore >= 0) {
        count++;
      }
    });
    return count;
  }

  canPredict(fixture: any): boolean {
    return !this.isFixtureDisabled(fixture);
  }

  isFixtureFinished(fixture: any): boolean {
    return fixture.status === "finished";
  }

  getPredictionPoints(fixture: any): number {
    const prediction = this.predictions.find((p) => p.fixtureId === fixture.id);
    return prediction?.points || 0;
  }

  trackByFixtureId(index: number, fixture: any): number {
    return fixture.id;
  }

  getFormattedDate(date: string): string {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  getFormattedDeadline(deadline: string): string {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (deadlineDate.getTime() - now.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 0) {
      return "Deadline passed";
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes left`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? "s" : ""} left`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} day${days > 1 ? "s" : ""} left`;
    }
  }

  private computeDoubleLock(): boolean {
    const now = new Date();
    // If user has any double AND that double's fixture is locked (deadline passed OR not upcoming)
    return this.existingPredictions.some((p) => {
      if (!p.isDouble && !p.is_double) return false;
      const fx = this.fixtures.find((f) => f.id === p.fixtureId);
      if (!fx) return false;
      const locked = now >= new Date(fx.deadline) || fx.status !== "upcoming";
      return locked;
    });
  }
}
