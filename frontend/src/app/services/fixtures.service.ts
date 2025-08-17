import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Fixture, CreateFixtureRequest, UpdateFixtureRequest } from '../models/fixture.model';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class FixturesService {
  private apiUrl = `${environment.apiUrl}/fixtures`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getFixtures(): Observable<Fixture[]> {
    return this.http.get<any>(this.apiUrl, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.data || response)
    );
  }

  getFixturesByGameweek(gameweek: number): Observable<Fixture[]> {
    return this.http.get<any>(`${this.apiUrl}/gameweek/${gameweek}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.data || response)
    );
  }

  getFixtureById(id: number): Observable<Fixture> {
    return this.http.get<any>(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.data || response)
    );
  }

  createFixture(fixture: CreateFixtureRequest): Observable<Fixture> {
    return this.http.post<any>(this.apiUrl, fixture, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.data || response)
    );
  }

  updateFixture(id: number, fixture: UpdateFixtureRequest): Observable<Fixture> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, fixture, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.data || response)
    );
  }

  deleteFixture(id: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(() => {})
    );
  }

  getUpcomingFixtures(): Observable<Fixture[]> {
    return this.http.get<any>(`${this.apiUrl}/upcoming`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.data || response)
    );
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }
}