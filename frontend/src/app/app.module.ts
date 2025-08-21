import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { HttpClientModule, HTTP_INTERCEPTORS } from "@angular/common/http";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { FixturesComponent } from "./components/fixtures/fixtures.component";
import { PredictionsComponent } from "./components/predictions/predictions.component";
import { LeaderboardComponent } from "./components/leaderboard/leaderboard.component";
import { AuthComponent } from "./components/auth/auth.component";
import { FixtureFormComponent } from "./components/fixture-form/fixture-form.component";
import { AuthGuard } from "./guards/auth.guard";
import { AuthInterceptor } from "./interceptors/auth.interceptor";
import { LoadingComponent } from './components/loading/loading.component';
import { LoadingInterceptor } from './interceptors/loading.interceptor';

@NgModule({
  declarations: [
    AppComponent,
    FixturesComponent,
    PredictionsComponent,
    LeaderboardComponent,
    AuthComponent,
    FixtureFormComponent,
    LoadingComponent,
  ],
  imports: [
    BrowserModule,
    CommonModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    AppRoutingModule,
  ],
  providers: [
    AuthGuard,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoadingInterceptor,
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
