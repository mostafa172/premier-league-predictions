/* filepath: frontend/src/app/app-routing.module.ts */
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthComponent } from './components/auth/auth.component';
import { FixturesComponent } from './components/fixtures/fixtures.component';
import { PredictionsComponent } from './components/predictions/predictions.component';
import { LeaderboardComponent } from './components/leaderboard/leaderboard.component';
import { FixtureFormComponent } from './components/fixture-form/fixture-form.component';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: '/auth', pathMatch: 'full' },
  { path: 'auth', component: AuthComponent },
  { path: 'fixtures', component: FixturesComponent, canActivate: [AuthGuard] },
  { path: 'predictions', component: PredictionsComponent, canActivate: [AuthGuard] },
  { path: 'leaderboard', component: LeaderboardComponent, canActivate: [AuthGuard] },
  { path: 'admin/fixtures', component: FixtureFormComponent, canActivate: [AuthGuard] },
  { path: 'admin/fixtures/:id', component: FixtureFormComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '/auth' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }