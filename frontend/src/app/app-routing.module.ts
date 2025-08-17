import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { AuthComponent } from './components/auth/auth.component';
import { FixturesComponent } from './components/fixtures/fixtures.component';
import { PredictionsComponent } from './components/predictions/predictions.component';
import { LeaderboardComponent } from './components/leaderboard/leaderboard.component';
import { FixtureFormComponent } from './components/fixture-form/fixture-form.component';

const routes: Routes = [
  { path: '', redirectTo: '/fixtures', pathMatch: 'full' }, // Change to fixtures
  { path: 'auth', component: AuthComponent },
  { path: 'fixtures', component: FixturesComponent, canActivate: [AuthGuard] },
  { path: 'predictions', component: PredictionsComponent, canActivate: [AuthGuard] },
  { path: 'leaderboard', component: LeaderboardComponent, canActivate: [AuthGuard] },
  { path: 'admin/add-fixture', component: FixtureFormComponent, canActivate: [AuthGuard] },
  { path: 'admin/edit-fixture/:id', component: FixtureFormComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '/fixtures' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }