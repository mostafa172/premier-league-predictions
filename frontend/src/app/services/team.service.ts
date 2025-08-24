/* filepath: frontend/src/app/services/team.service.ts */
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { Team } from '../models/team.model';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getAllTeams(): Observable<{success: boolean, data: Team[]}> {
    return this.http.get<{success: boolean, data: Team[]}>(`${this.API_URL}/teams`, { headers: this.getHeaders() });
  }

  getTeamById(id: number): Observable<{success: boolean, data: Team}> {
    return this.http.get<{success: boolean, data: Team}>(`${this.API_URL}/teams/${id}`, { headers: this.getHeaders() });
  }
}