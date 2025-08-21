/* filepath: frontend/src/app/services/prediction.service.ts */
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: "root",
})
export class PredictionService {
  private readonly API_URL = "http://localhost:3000/api";

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    });
  }

  getUserPredictions(): Observable<any> {
    return this.http.get(`${this.API_URL}/predictions/user`, {
      headers: this.getHeaders(),
    });
  }

  getUserPredictionsByGameweek(gameweek: number): Observable<any> {
    return this.http.get(
      `${this.API_URL}/predictions/user/gameweek/${gameweek}`,
      { headers: this.getHeaders() }
    );
  }

  // Fix: Add missing headers to createPrediction
  createPrediction(predictionData: any): Observable<any> {
    return this.http.post(`${this.API_URL}/predictions`, predictionData, {
      headers: this.getHeaders(),
    });
  }

  // Add missing submitPrediction method (alias for createPrediction)
  submitPrediction(prediction: any): Observable<any> {
    return this.createPrediction(prediction);
  }

  updatePrediction(id: number, prediction: any): Observable<any> {
    return this.http.put(`${this.API_URL}/predictions/${id}`, prediction, {
      headers: this.getHeaders(),
    });
  }

  deletePrediction(id: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/predictions/${id}`, {
      headers: this.getHeaders(),
    });
  }

  getLeaderboard(): Observable<any> {
    return this.http.get(`${this.API_URL}/predictions/leaderboard`, {
      headers: this.getHeaders(),
    });
  }
}