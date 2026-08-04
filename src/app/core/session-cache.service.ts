/**
 * session-cache.service.ts — eliminates boot-flicker by caching the
 * last-known session state in sessionStorage.
 *
 * Why sessionStorage and not localStorage?
 *  - sessionStorage is cleared when the browser tab is closed, preventing
 *    stale "authenticated" state from persisting after the httpOnly cookie
 *    has expired in a different tab.
 *  - On a normal refresh (same tab) sessionStorage survives, so the UI
 *    renders instantly with the cached user/shop before the network resolves.
 *
 * The cache is only used as a UI hint — the real auth check (GET /auth/session)
 * still fires in the background and overwrites this value.  If the network
 * returns unauthenticated the guard re-checks and redirects to /signin.
 */
import { Injectable } from '@angular/core';
import type { SessionState } from './auth.service';

const KEY = 'sp_session';

@Injectable({ providedIn: 'root' })
export class SessionCacheService {
  /** Read the cached session synchronously. Returns null if nothing is cached. */
  read(): SessionState | null {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SessionState;
    } catch {
      return null;
    }
  }

  /** Persist session state after a successful auth check. */
  write(state: SessionState): void {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Quota exceeded or private browsing — ignore silently.
    }
  }

  /** Clear on sign-out so the next tab load starts fresh. */
  clear(): void {
    try {
      sessionStorage.removeItem(KEY);
    } catch { /* ignore */ }
  }
}
