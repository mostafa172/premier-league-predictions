/* filepath: frontend/src/app/app.module.ts */
import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { HTTP_INTERCEPTORS, HttpClientModule } from "@angular/common/http";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";

// Import all your components
import { AuthComponent } from "./components/auth/auth.component";
import { FixturesComponent } from "./components/fixtures/fixtures.component";
import { PredictionsComponent } from "./components/predictions/predictions.component";
import { LeaderboardComponent } from "./components/leaderboard/leaderboard.component";
import { FixtureFormComponent } from "./components/fixture-form/fixture-form.component";
import { UserPredictionsModalComponent } from "./components/user-predictions-modal/user-predictions-modal.component";
import { LeaguesComponent } from "./components/leagues/leagues.component";
import { LeagueDetailComponent } from "./components/league-detail/league-detail.component";

// Import your services and guards
import { AuthService } from "./services/auth.service";
import { LoadingService } from "./services/loading.service";
import { LeagueService } from "./services/league.service";
import { AuthGuard } from "./guards/auth.guard";
import { LoadingComponent } from "./components/loading/loading.component";
import { RouterModule } from "@angular/router";
import { AuthInterceptor } from "./interceptors/auth.interceptor";

@NgModule({
  declarations: [
    AppComponent,
    AuthComponent,
    FixturesComponent,
    PredictionsComponent,
    LeaderboardComponent,
    AuthComponent,
    FixtureFormComponent,
    LoadingComponent,
    UserPredictionsModalComponent,
    LeaguesComponent,
    LeagueDetailComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    AppRoutingModule,
    RouterModule,
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
    AuthService,
    LoadingService,
    LeagueService,
    AuthGuard,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
