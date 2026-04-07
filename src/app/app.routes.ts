import { Routes } from '@angular/router';
import { participantReadyGuard } from '@app/core/guards/participant-ready.guard';
import { sessionExistsGuard } from '@app/core/guards/session-exists.guard';
import { AppShellComponent } from '@app/core/layout/app-shell.component';

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('@app/features/home/pages/home-page.component').then((m) => m.HomePageComponent),
      },
      {
        path: 'session/create',
        loadComponent: () =>
          import('@app/features/session-create/pages/session-create-page.component').then(
            (m) => m.SessionCreatePageComponent,
          ),
      },
      {
        path: 'session/join/:sessionId',
        loadComponent: () =>
          import('@app/features/session-join/pages/session-join-page.component').then(
            (m) => m.SessionJoinPageComponent,
          ),
      },
      {
        path: 'session/:sessionId',
        loadComponent: () =>
          import('@app/features/planning-session/pages/planning-session-page.component').then(
            (m) => m.PlanningSessionPageComponent,
          ),
        canActivate: [sessionExistsGuard, participantReadyGuard],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
