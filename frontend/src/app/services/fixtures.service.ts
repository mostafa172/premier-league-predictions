import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Fixture, CreateFixtureRequest, UpdateFixtureRequest } from '../models/fixture.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FixturesService {
  private apiUrl = `${environment.apiUrl}/fixtures`;

  constructor(private http: HttpClient) {}

  getFixtures(): Observable<Fixture[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(response => response.data || response),
      catchError(error => {
        console.error('Error fetching fixtures:', error);
        throw error;
      })
    );
  }

  getFixturesByGameweek(gameweek: number): Observable<Fixture[]> {
    return this.http.get<any>(`${this.apiUrl}/gameweek/${gameweek}`).pipe(
      map(response => response.data || response),
      catchError(error => {
        console.error('Error fetching fixtures by gameweek:', error);
        throw error;
      })
    );
  }

  getFixtureById(id: number): Observable<Fixture> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(response => response.data || response),
      catchError(error => {
        console.error('Error fetching fixture by ID:', error);
        throw error;
      })
    );
  }

  createFixture(fixture: CreateFixtureRequest): Observable<Fixture> {
    return this.http.post<any>(this.apiUrl, fixture).pipe(
      map(response => response.data || response),
      catchError(error => {
        console.error('Error creating fixture:', error);
        throw error;
      })
    );
  }

  updateFixture(id: number, fixture: UpdateFixtureRequest): Observable<Fixture> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, fixture).pipe(
      map(response => response.data || response),
      catchError(error => {
        console.error('Error updating fixture:', error);
        throw error;
      })
    );
  }

  deleteFixture(id: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`).pipe(
      map(() => {}),
      catchError(error => {
        console.error('Error deleting fixture:', error);
        throw error;
      })
    );
  }

  getUpcomingFixtures(): Observable<Fixture[]> {
    return this.http.get<any>(`${this.apiUrl}/upcoming`).pipe(
      map(response => response.data || response),
      catchError(error => {
        console.error('Error fetching upcoming fixtures:', error);
        throw error;
      })
    );
  }
}