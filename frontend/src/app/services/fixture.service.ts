import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FixtureService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getAllFixtures(): Observable<any> {
    return this.http.get(`${this.API_URL}/fixtures`, { headers: this.getHeaders() });
  }

  getFixturesByGameweek(gameweek: number): Observable<any> {
    return this.http.get(`${this.API_URL}/fixtures/gameweek/${gameweek}`, { headers: this.getHeaders() });
  }

  getUpcomingFixtures(): Observable<any> {
    return this.http.get(`${this.API_URL}/fixtures/upcoming`, { headers: this.getHeaders() });
  }

  getFixtureById(id: number): Observable<any> {
    return this.http.get(`${this.API_URL}/fixtures/${id}`, { headers: this.getHeaders() });
  }

  createFixture(fixture: any): Observable<any> {
    return this.http.post(`${this.API_URL}/fixtures`, fixture, { headers: this.getHeaders() });
  }

  updateFixture(id: number, fixture: any): Observable<any> {
    return this.http.put(`${this.API_URL}/fixtures/${id}`, fixture, { headers: this.getHeaders() });
  }

  deleteFixture(id: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/fixtures/${id}`, { headers: this.getHeaders() });
  }
}