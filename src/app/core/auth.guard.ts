/**
 * auth.guard.ts
 *
 * authGuard — allows authenticated users through, redirects others to /signin.
 *
 * Key behaviour change:
 *  When the session is already cached in sessionStorage, _loading is false
 *  from the start and the guard resolves SYNCHRONOUSLY — zero navigation
 *  delay on refresh.
 *
 *  On uncached first-boot (no sessionStorage entry), _loading is true and
 *  we wait up to 8 seconds for the network verify to resolve.
 *
 * publicGuard — redirects signed-in users to /dashboard (login/signup pages).
 */
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  // If still loading (first uncached boot), wait for network verify.
  if (auth.loading()) {
    await waitUntil(() => !auth.loading());
  }

  return auth.isAuthenticated()
    ? true
    : router.createUrlTree(['/signin'], {
        queryParams: { returnUrl: router.routerState.snapshot.url },
      });
};

export const publicGuard: CanActivateFn = async () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.loading()) {
    await waitUntil(() => !auth.loading());
  }

  return auth.isAuthenticated()
    ? router.createUrlTree(['/dashboard'])
    : true;
};

function waitUntil(condition: () => boolean, maxMs = 8_000): Promise<void> {
  return new Promise(resolve => {
    if (condition()) { resolve(); return; }
    const interval = setInterval(() => {
      if (condition()) { clearInterval(interval); resolve(); }
    }, 30); // poll every 30 ms — fast enough, cheap enough
    setTimeout(() => { clearInterval(interval); resolve(); }, maxMs);
  });
}
