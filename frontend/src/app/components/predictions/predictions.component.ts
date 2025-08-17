import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { PredictionsService } from '../../services/predictions.service';
import { FixturesService } from '../../services/fixtures.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-predictions',
  templateUrl: './predictions.component.html',
  styleUrls: ['./predictions.component.css']
})
export class PredictionsComponent implements OnInit {
  predictionsForm: FormGroup;
  fixtures: any[] = [];
  existingPredictions: any[] = [];
  loading = true;
  saving = false;
  error = '';
  success = '';
  gameweek = 1;
  gameweeks = Array.from({length: 38}, (_, i) => i + 1); // Fixed gameweek selector
  currentDoubleIndex = -1; // Track which prediction is selected as double

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private predictionsService: PredictionsService,
    private fixturesService: FixturesService,
    private router: Router
  ) {
    this.predictionsForm = this.fb.group({
      predictions: this.fb.array([])
    });
  }

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth']);
      return;
    }
    this.loadGameweekData();
  }

  get predictionsArray(): FormArray {
    return this.predictionsForm.get('predictions') as FormArray;
  }

  loadGameweekData(): void {
    this.loading = true;
    this.error = '';

    Promise.all([
      this.fixturesService.getFixturesByGameweek(this.gameweek).toPromise(),
      this.predictionsService.getUserPredictionsByGameweek(this.gameweek).toPromise()
    ]).then(([fixtures, predictions]) => {
      this.fixtures = fixtures || [];
      this.existingPredictions = predictions || [];
      this.setupPredictionsForm();
      this.loading = false;
    }).catch(err => {
      console.error('Error loading gameweek data:', err);
      this.error = 'Failed to load fixtures and predictions.';
      this.loading = false;
    });
  }

  setupPredictionsForm(): void {
    // Clear existing form array
    while (this.predictionsArray.length !== 0) {
      this.predictionsArray.removeAt(0);
    }

    // Reset double tracking
    this.currentDoubleIndex = -1;

    // Add form group for each fixture
    this.fixtures.forEach((fixture, index) => {
      const existingPrediction = this.existingPredictions.find(p => p.fixture.id === fixture.id);
      
      // Track which prediction is currently set as double
      if (existingPrediction && existingPrediction.isDouble) {
        this.currentDoubleIndex = index;
      }
      
      const predictionGroup = this.fb.group({
        fixtureId: [fixture.id],
        homeScore: [
          existingPrediction ? existingPrediction.homeScore : '',
          [Validators.min(0), Validators.max(20)]
        ],
        awayScore: [
          existingPrediction ? existingPrediction.awayScore : '',
          [Validators.min(0), Validators.max(20)]
        ],
        isDouble: [existingPrediction ? existingPrediction.isDouble : false],
        predictionId: [existingPrediction ? existingPrediction.id : null]
      });

      this.predictionsArray.push(predictionGroup);
    });
  }

  onGameweekChange(newGameweek: number): void {
    this.gameweek = newGameweek;
    this.loadGameweekData();
  }

  isFixtureDisabled(fixture: any): boolean {
    // Disable if status is not upcoming or deadline has passed
    if (fixture.status !== 'upcoming') {
      return true;
    }
    
    const now = new Date();
    const deadline = new Date(fixture.deadline);
    return now > deadline;
  }

  hasValidPrediction(index: number): boolean {
    const prediction = this.predictionsArray.at(index);
    const homeScore = prediction.get('homeScore')?.value;
    const awayScore = prediction.get('awayScore')?.value;
    
    return homeScore !== '' && homeScore !== null && 
           awayScore !== '' && awayScore !== null &&
           homeScore >= 0 && awayScore >= 0;
  }

  onDoubleChange(index: number): void {
    // Clear all other double selections
    for (let i = 0; i < this.predictionsArray.length; i++) {
      if (i !== index) {
        this.predictionsArray.at(i).get('isDouble')?.setValue(false);
      }
    }
    
    // Update current double index
    const isDouble = this.predictionsArray.at(index).get('isDouble')?.value;
    this.currentDoubleIndex = isDouble ? index : -1;
  }

  saveAllPredictions(): void {
    this.saving = true;
    this.error = '';
    this.success = '';

    const predictions = [];
    
    // Collect all valid predictions
    for (let i = 0; i < this.predictionsArray.length; i++) {
      const fixture = this.fixtures[i];
      const formGroup = this.predictionsArray.at(i);
      
      if (this.hasValidPrediction(i) && !this.isFixtureDisabled(fixture)) {
        predictions.push({
          fixtureId: formGroup.get('fixtureId')?.value,
          homeScore: parseInt(formGroup.get('homeScore')?.value),
          awayScore: parseInt(formGroup.get('awayScore')?.value),
          isDouble: formGroup.get('isDouble')?.value || false,
          predictionId: formGroup.get('predictionId')?.value
        });
      }
    }

    if (predictions.length === 0) {
      this.error = 'No valid predictions to save.';
      this.saving = false;
      return;
    }

    // Save all predictions
    const saveRequests = predictions.map(prediction => 
      this.predictionsService.submitPrediction({
        fixtureId: prediction.fixtureId,
        homeScore: prediction.homeScore,
        awayScore: prediction.awayScore,
        isDouble: prediction.isDouble
      }).toPromise()
    );

    Promise.all(saveRequests).then(() => {
      this.success = `Successfully saved ${predictions.length} prediction(s)!`;
      this.saving = false;
      // Reload to get updated predictions
      setTimeout(() => {
        this.loadGameweekData();
      }, 1000);
    }).catch(err => {
      console.error('Error saving predictions:', err);
      this.error = 'Failed to save some predictions. Please try again.';
      this.saving = false;
    });
  }

  clearAllPredictions(): void {
    if (confirm('Are you sure you want to clear all predictions for this gameweek?')) {
      this.setupPredictionsForm();
    }
  }
}