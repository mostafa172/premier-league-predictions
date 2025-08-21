/* filepath: frontend/src/app/services/team.service.ts */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Team } from '../models/team.model';

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  private apiUrl = 'http://localhost:3000/api/teams';

  constructor(private http: HttpClient) {}

  getAllTeams(): Observable<{success: boolean, data: Team[]}> {
    return this.http.get<{success: boolean, data: Team[]}>(`${this.apiUrl}`);
  }

  getTeamById(id: number): Observable<{success: boolean, data: Team}> {
    return this.http.get<{success: boolean, data: Team}>(`${this.apiUrl}/${id}`);
  }
}