import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * AuthLayoutComponent — wraps public routes (/signin).
 * Centred card layout; no top nav, no sidebar.
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <router-outlet />
    </div>
  `,
})
export class AuthLayoutComponent {}
