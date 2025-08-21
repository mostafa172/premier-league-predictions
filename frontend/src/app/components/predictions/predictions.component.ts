/* filepath: frontend/src/app/components/predictions/predictions.component.ts */
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { PredictionService } from '../../services/prediction.service';
import { FixtureService } from '../../services/fixture.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-predictions',
  templateUrl: './predictions.component.html',
  styleUrls: ['./predictions.component.scss']
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
  error = '';
  success = '';
  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private predictionService: PredictionService,
    private fixtureService: FixtureService
  ) {
    this.predictionsForm = this.fb.group({
      predictions: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.loadFixturesAndPredictions();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  get predictionsArray(): FormArray {
    return this.predictionsForm.get('predictions') as FormArray;
  }

  onGameweekChange(): void {
    this.loadFixturesAndPredictions();
  }

  loadFixturesAndPredictions(): void {
    this.loading = true;
    this.error = '';
    this.success = '';

    const fixturesSub = this.fixtureService.getFixturesByGameweek(this.gameweek).subscribe({
      next: (fixturesResponse: any) => {
        if (fixturesResponse.success) {
          this.fixtures = fixturesResponse.data;
          
          const predictionsSub = this.predictionService.getUserPredictionsByGameweek(this.gameweek).subscribe({
            next: (predictionsResponse: any) => {
              this.loading = false;
              if (predictionsResponse.success) {
                this.predictions = predictionsResponse.data;
                this.existingPredictions = [...this.predictions];
                this.buildPredictionsForm();
              }
            },
            error: (error: any) => {
              this.loading = false;
              this.error = 'Error loading predictions';
              console.error('Error loading predictions:', error);
            }
          });
          this.subscriptions.push(predictionsSub);
        }
      },
      error: (error: any) => {
        this.loading = false;
        this.error = 'Error loading fixtures';
        console.error('Error loading fixtures:', error);
      }
    });
    this.subscriptions.push(fixturesSub);
  }

  // Fix: Correct FormArray implementation
  buildPredictionsForm(): void {
    // Clear existing form array
    while (this.predictionsArray.length !== 0) {
      this.predictionsArray.removeAt(0);
    }

    this.fixtures.forEach((fixture) => {
      const existingPrediction = this.predictions.find(
        p => p.fixtureId === fixture.id
      );

      const predictionGroup = this.fb.group({
        fixtureId: [fixture.id, Validators.required],
        homeScore: [existingPrediction?.homeScore ?? 0, [Validators.required, Validators.min(0)]],
        awayScore: [existingPrediction?.awayScore ?? 0, [Validators.required, Validators.min(0)]],
        predictionId: [existingPrediction?.id || null]
      });

      // Fix: Direct push without casting
      this.predictionsArray.push(predictionGroup);
    });
  }

  async saveAllPredictions(): Promise<void> {
    if (this.predictionsForm.valid) {
      this.saving = true;
      this.error = '';
      this.success = '';

      const formData = this.predictionsForm.value.predictions;
      
      try {
        const promises = formData.map(async (prediction: any) => {
          if (prediction.predictionId) {
            return this.predictionService.updatePrediction(
              prediction.predictionId,
              prediction.homeScore,
              prediction.awayScore
            ).toPromise();
          } else {
            return this.predictionService.createPrediction({
              fixtureId: prediction.fixtureId,
              homeScore: prediction.homeScore,
              awayScore: prediction.awayScore
            }).toPromise();
          }
        });

        await Promise.all(promises);
        
        this.saving = false;
        this.success = 'Predictions saved successfully!';
        this.loadFixturesAndPredictions();
        
      } catch (error) {
        this.saving = false;
        this.error = 'Error saving predictions';
        console.error('Error saving predictions:', error);
      }
    } else {
      this.error = 'Please fill in all prediction fields correctly';
    }
  }

  isFixtureDisabled(fixture: any): boolean {
    const deadline = new Date(fixture.deadline);
    const now = new Date();
    return now >= deadline || fixture.status === 'finished' || fixture.status === 'live';
  }

  hasValidPrediction(index: number): boolean {
    const predictionGroup = this.predictionsArray.at(index);
    if (!predictionGroup) return false;
    
    const homeScore = predictionGroup.get('homeScore')?.value;
    const awayScore = predictionGroup.get('awayScore')?.value;
    
    return homeScore !== null && homeScore !== undefined && 
           awayScore !== null && awayScore !== undefined &&
           homeScore >= 0 && awayScore >= 0;
  }

  onDoubleChange(index: number): void {
    const predictionGroup = this.predictionsArray.at(index);
    if (predictionGroup) {
      console.log('Double points selected for prediction:', index);
    }
  }

  clearAllPredictions(): void {
    if (confirm('Are you sure you want to clear all predictions for this gameweek?')) {
      this.predictionsArray.controls.forEach(control => {
        control.get('homeScore')?.setValue(0);
        control.get('awayScore')?.setValue(0);
      });
      this.success = '';
      this.error = '';
    }
  }

  submitPrediction(predictionData: any): void {
    const sub = this.predictionService.createPrediction(predictionData).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.success = 'Prediction submitted successfully!';
          this.loadFixturesAndPredictions();
        }
      },
      error: (error: any) => {
        console.error('Error submitting prediction:', error);
        this.error = 'Error submitting prediction';
      }
    });
    this.subscriptions.push(sub);
  }

  canPredict(fixture: any): boolean {
    return !this.isFixtureDisabled(fixture);
  }

  isFixtureFinished(fixture: any): boolean {
    return fixture.status === 'finished';
  }

  getPredictionPoints(fixture: any): number {
    const prediction = this.predictions.find(p => p.fixtureId === fixture.id);
    return prediction?.points || 0;
  }

  trackByFixtureId(index: number, fixture: any): number {
    return fixture.id;
  }

  getFormattedDate(date: string): string {
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getFormattedDeadline(deadline: string): string {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffInMinutes = Math.floor((deadlineDate.getTime() - now.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 0) {
      return 'Deadline passed';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes left`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} left`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} day${days > 1 ? 's' : ''} left`;
    }
  }
}