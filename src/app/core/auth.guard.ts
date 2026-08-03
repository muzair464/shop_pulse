import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * authGuard — waits for the initial session restore to complete,
 * then lets authenticated users through or redirects to /signin.
 */
export const authGuard: CanActivateFn = async () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  // Wait for the async session restore from GET /api/v1/auth/session
  if (auth.loading()) {
    await waitUntil(() => !auth.loading());
  }

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/signin'], {
    queryParams: { returnUrl: router.routerState.snapshot.url },
  });
};

/**
 * publicGuard — redirects to /dashboard if already authenticated.
 * Used on the /signin route to prevent signed-in users from seeing the login page.
 */
export const publicGuard: CanActivateFn = async () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.loading()) {
    await waitUntil(() => !auth.loading());
  }

  if (auth.isAuthenticated()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};

function waitUntil(condition: () => boolean, maxMs = 8000): Promise<void> {
  return new Promise((resolve) => {
    if (condition()) { resolve(); return; }
    const interval = setInterval(() => {
      if (condition()) { clearInterval(interval); resolve(); }
    }, 50);
    setTimeout(() => { clearInterval(interval); resolve(); }, maxMs);
  });
}
