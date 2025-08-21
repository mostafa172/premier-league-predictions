import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray } from '@angular/forms';
import { PredictionService } from '../../services/prediction.service';
import { FixtureService } from '../../services/fixture.service';

@Component({
  selector: 'app-predictions',
  templateUrl: './predictions.component.html',
  styleUrls: ['./predictions.component.scss']
})
export class PredictionsComponent implements OnInit {
  predictionsForm: FormGroup;
  fixtures: any[] = [];
  gameweek = 1;
  gameweeks = Array.from({ length: 38 }, (_, i) => i + 1);
  loading = false;
  saving = false;
  error = '';
  success = '';
  existingPredictions: any[] = [];

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
    this.loadFixtures();
    this.loadExistingPredictions();
  }

  get predictionsArray(): FormArray {
    return this.predictionsForm.get('predictions') as FormArray;
  }

  loadFixtures(): void {
    this.loading = true;
    this.error = '';
    this.fixtureService.getFixturesByGameweek(this.gameweek).subscribe({
      next: (response: any) => {
        this.loading = false;
        if (response.success) {
          this.fixtures = response.data;
          this.buildForm();
        }
      },
      error: (error: any) => {
        this.loading = false;
        this.error = 'Error loading fixtures';
        console.error('Error loading fixtures:', error);
      }
    });
  }

  loadExistingPredictions(): void {
    this.predictionService.getUserPredictionsByGameweek(this.gameweek).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.existingPredictions = response.data;
          this.populateExistingPredictions();
        }
      },
      error: (error: any) => {
        console.error('Error loading existing predictions:', error);
      }
    });
  }

  buildForm(): void {
    // Create a new FormArray with FormGroups for each fixture
    const newPredictionsArray = this.fb.array(
      this.fixtures.map(() => 
        this.fb.group({
          homeScore: [''],
          awayScore: [''],
          isDouble: [false]
        })
      )
    );
  
    // Replace the predictions FormArray in the main form
    this.predictionsForm.setControl('predictions', newPredictionsArray);
  }

  populateExistingPredictions(): void {
    this.existingPredictions.forEach(pred => {
      const fixtureIndex = this.fixtures.findIndex(f => f.id === pred.fixtureId);
      if (fixtureIndex >= 0) {
        const formGroup = this.predictionsArray.at(fixtureIndex);
        formGroup.patchValue({
          homeScore: pred.predictedHomeScore,
          awayScore: pred.predictedAwayScore,
          isDouble: pred.isDouble
        });
      }
    });
  }

  onGameweekChange(gameweek: number): void {
    this.gameweek = gameweek;
    this.loadFixtures();
    this.loadExistingPredictions();
  }

  isFixtureDisabled(fixture: any): boolean {
    return new Date() > new Date(fixture.deadline) || fixture.status !== 'upcoming';
  }

  hasValidPrediction(index: number): boolean {
    const prediction = this.predictionsArray.at(index);
    const homeScore = prediction.get('homeScore')?.value;
    const awayScore = prediction.get('awayScore')?.value;
    return homeScore !== '' && awayScore !== '' && homeScore !== null && awayScore !== null;
  }

  onDoubleChange(index: number): void {
    // Ensure only one double per gameweek
    const currentValue = this.predictionsArray.at(index).get('isDouble')?.value;
    
    if (currentValue) {
      // Uncheck all other doubles
      this.predictionsArray.controls.forEach((control, i) => {
        if (i !== index) {
          control.get('isDouble')?.setValue(false);
        }
      });
    }
  }

  saveAllPredictions(): void {
    this.saving = true;
    this.error = '';
    this.success = '';
  
    const predictions = this.fixtures.map((fixture, index) => {
      const formValue = this.predictionsArray.at(index).value;
      return {
        fixtureId: fixture.id,
        homeScore: parseInt(formValue.homeScore),
        awayScore: parseInt(formValue.awayScore),
        isDouble: formValue.isDouble
      };
    }).filter(pred => 
      pred.homeScore !== null && 
      pred.awayScore !== null && 
      !isNaN(pred.homeScore) && 
      !isNaN(pred.awayScore)
    );
  
    if (predictions.length === 0) {
      this.saving = false;
      this.error = 'Please make at least one prediction';
      return;
    }
  
    // Save each prediction individually
    const promises = predictions.map(prediction => 
      this.predictionService.createPrediction(prediction).toPromise()
    );
  
    Promise.all(promises).then(() => {
      this.saving = false;
      this.success = 'All predictions saved successfully!';
      this.loadExistingPredictions(); // Reload to show updated predictions
    }).catch(error => {
      this.saving = false;
      this.error = 'Error saving predictions';
      console.error('Error saving predictions:', error);
    });
  }

  clearAllPredictions(): void {
    if (confirm('Are you sure you want to clear all predictions for this gameweek?')) {
      this.predictionsArray.controls.forEach(control => {
        control.reset();
      });
      this.success = '';
      this.error = '';
    }
  }

  // Individual prediction submission
  submitPrediction(fixtureId: number, homeScore: number, awayScore: number, isDouble: boolean = false): void {
    this.predictionService.submitPrediction({
      fixtureId,
      homeScore,
      awayScore,
      isDouble
    }).subscribe({
      next: (response: any) => {
        console.log('Prediction submitted successfully:', response);
      },
      error: (error: any) => {
        console.error('Error submitting prediction:', error);
      }
    });
  }
}