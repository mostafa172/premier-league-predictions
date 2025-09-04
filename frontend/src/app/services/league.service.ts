import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from 'src/environments/environment';
import { 
  League, 
  LeagueMember, 
  LeagueDetails, 
  CreateLeagueRequest, 
  JoinLeagueRequest,
  LeagueResponse,
  LeagueDetailsResponse,
  LeagueListResponse,
  JoinLeagueResponse
} from '../models/league.model';


@Injectable({
  providedIn: 'root'
})
export class LeagueService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  // Get all leagues
  getAllLeagues(): Observable<LeagueListResponse> {
    return this.http.get<LeagueListResponse>(`${this.API_URL}/leagues`, {
      headers: this.getHeaders(),
    });
  }

  // Get user's leagues
  getUserLeagues(): Observable<LeagueListResponse> {
    return this.http.get<LeagueListResponse>(`${this.API_URL}/leagues/my-leagues`, {
      headers: this.getHeaders(),
    });
  }

  // Create a new league
  createLeague(leagueData: CreateLeagueRequest): Observable<LeagueResponse> {
    return this.http.post<LeagueResponse>(`${this.API_URL}/leagues`, leagueData, {
      headers: this.getHeaders(),
    });
  }

  // Join a league by join code
  joinLeague(joinCode: string): Observable<JoinLeagueResponse> {
    return this.http.post<JoinLeagueResponse>(`${this.API_URL}/leagues/join`, { joinCode }, {
      headers: this.getHeaders(),
    });
  }

  // Leave a league
  leaveLeague(leagueId: number): Observable<{ success: boolean; message?: string }> {
    return this.http.delete<{ success: boolean; message?: string }>(`${this.API_URL}/leagues/${leagueId}/leave`, {
      headers: this.getHeaders(),
    });
  }

  // Get league details with members
  getLeagueDetails(leagueId: number): Observable<LeagueDetailsResponse> {
    return this.http.get<LeagueDetailsResponse>(`${this.API_URL}/leagues/${leagueId}`, {
      headers: this.getHeaders(),
    });
  }
}
