/**
 * token-refresh.service.ts — proactive background token refresh.
 *
 * Strategy:
 *  The Supabase access_token is a JWT whose `exp` claim is readable from
 *  the cookie (it's just base64 — not secret).  We decode it client-side
 *  and schedule a refresh 5 minutes before expiry.
 *
 *  If decoding fails (e.g. cookie is HttpOnly and unreadable — which it IS
 *  on cross-origin deploys), we fall back to a fixed 50-minute interval,
 *  which keeps the token fresh for a 1-hour Supabase default expiry and
 *  a 30-day expiry when rememberDevice=true.
 *
 * The refresh itself is POST /api/v1/auth/refresh — the backend reads the
 * refresh_token cookie and sets fresh access+refresh cookies.
 *
 * Start is called once after successful sign-in or session restore.
 * Stop is called on sign-out.
 */
import { Injectable, inject, NgZone } from '@angular/core';
import { ApiClient } from './api.client';

const FALLBACK_INTERVAL_MS = 50 * 60 * 1_000; // 50 minutes
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1_000; // refresh 5 min before exp

@Injectable({ providedIn: 'root' })
export class TokenRefreshService {
  private readonly api  = inject(ApiClient);
  private readonly zone = inject(NgZone);
  private timerId: ReturnType<typeof setTimeout> | null = null;

  start(): void {
    this.stop(); // cancel any previous timer
    const delayMs = this._computeDelay();
    // Run timer outside Angular's zone so it doesn't trigger CD on every tick.
    this.zone.runOutsideAngular(() => {
      this.timerId = setTimeout(() => void this._refresh(), delayMs);
    });
  }

  stop(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private async _refresh(): Promise<void> {
    try {
      await this.api.post('/api/v1/auth/refresh', {});
      // Reschedule after successful refresh.
      this.start();
    } catch {
      // Refresh failed — the 401 interceptor in ApiClient will handle the
      // next real request.  Don't reschedule to avoid a hammering loop.
      this.stop();
    }
  }

  /**
   * Attempt to read `exp` from the access_token cookie.
   * On cross-origin deployments the cookie is HttpOnly and document.cookie
   * won't contain it — we fall back to the fixed interval in that case.
   */
  private _computeDelay(): number {
    try {
      const match = document.cookie.match(/(?:^|;\s*)access_token=([^;]*)/);
      if (!match) return FALLBACK_INTERVAL_MS;
      const [, encoded] = match;
      const payload = JSON.parse(atob(encoded.split('.')[1])) as { exp?: number };
      if (!payload.exp) return FALLBACK_INTERVAL_MS;
      const expiresInMs = payload.exp * 1_000 - Date.now();
      const delay = Math.max(expiresInMs - REFRESH_BEFORE_EXPIRY_MS, 10_000);
      return delay;
    } catch {
      return FALLBACK_INTERVAL_MS;
    }
  }
}
