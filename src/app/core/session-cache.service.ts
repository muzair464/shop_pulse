/**
 * session-cache.service.ts — session state is always fetched fresh from the
 * server (GET /api/v1/auth/session). No browser storage (sessionStorage,
 * localStorage, or IndexedDB) is used to persist auth state.
 *
 * This service is kept as a no-op shim so call sites in AuthService do not
 * need to be changed; every method is intentionally a no-op.
 */
import { Injectable } from '@angular/core';
import type { SessionState } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SessionCacheService {
  /** Always returns null — session is fetched from the server on every boot. */
  read(): SessionState | null {
    return null;
  }

  /** No-op — session state is not persisted to any browser storage. */
  write(_state: SessionState): void {
    // intentionally empty
  }

  /** No-op — nothing to clear. */
  clear(): void {
    // intentionally empty
  }
}
