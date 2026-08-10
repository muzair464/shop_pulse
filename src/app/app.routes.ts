import { Routes } from '@angular/router';
import { authGuard, publicGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },

  // ── Public auth shell (centred card layout, no nav) ───────────────────────
  {
    path: '',
    loadComponent: () =>
      import('./layout/auth-layout.component').then(m => m.AuthLayoutComponent),
    children: [
      {
        path: 'signin',
        canActivate: [publicGuard],
        loadComponent: () =>
          import('./features/auth/sign-in.component').then(m => m.SignInComponent),
      },
      {
        path: 'forgot-password',
        canActivate: [publicGuard],
        loadComponent: () =>
          import('./features/auth/forgot-password.component').then(m => m.ForgotPasswordComponent),
      },
      {
        // New account registration — 2-step form (account + shop details).
        // publicGuard redirects signed-in users to /dashboard.
        path: 'signup',
        canActivate: [publicGuard],
        loadComponent: () =>
          import('./features/auth/sign-up.component').then(m => m.SignUpComponent),
      },
      {
        // Post-signup holding screen AND the email-confirmation OTP callback.
        // No guard — the page handles both roles:
        //   /verify-email?email=x@y.z          → "check your inbox" screen
        //   /verify-email?token_hash=X&type=email → exchanges OTP → /dashboard
        path: 'verify-email',
        loadComponent: () =>
          import('./features/auth/verify-email.component').then(m => m.VerifyEmailComponent),
      },
      {
        // Invitation acceptance + password-reset OTP callback.
        // No guard — the token_hash IS the credential.
        path: 'set-password',
        loadComponent: () =>
          import('./features/auth/set-password.component').then(m => m.SetPasswordComponent),
      },
    ],
  },

  // ── Authenticated shell ───────────────────────────────────────────────────
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/authenticated-layout.component').then(m => m.AuthenticatedLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'pos',
        loadComponent: () =>
          import('./features/pos/pos.component').then(m => m.PosComponent),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/inventory/inventory.component').then(m => m.InventoryComponent),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/orders/orders.component').then(m => m.OrdersComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(m => m.SettingsComponent),
      },
    ],
  },

  { path: '**', redirectTo: 'dashboard' },
];
