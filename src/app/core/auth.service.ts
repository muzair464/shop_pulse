import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ApiClient, ApiError } from './api.client';
import { SessionCacheService } from './session-cache.service';
import { TokenRefreshService } from './token-refresh.service';
import { LocalDbService } from './local-db.service';

export interface SessionUser {
  id:    string;
  email?: string;
}

export interface SessionShop {
  id:   string;
  name: string;
}

export interface SessionState {
  authenticated: boolean;
  user: SessionUser | null;
  shop: SessionShop | null;
}

export interface SignInOptions {
  email:          string;
  password:       string;
  rememberDevice: boolean;
}

export interface SignUpOptions {
  email:    string;
  password: string;
  shopName: string;
  phone?:   string;
  address?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly router       = inject(Router);
  private readonly api          = inject(ApiClient);
  private readonly sessionCache = inject(SessionCacheService);
  private readonly tokenRefresh = inject(TokenRefreshService);
  private readonly localDb      = inject(LocalDbService);

  // ── Signals ──────────────────────────────────────────────────────────────

  /**
   * Pre-populated from sessionStorage so the guard resolves synchronously
   * on refresh — zero flicker.  Overwritten once the network check resolves.
   */
  private readonly _session = signal<SessionState>(
    this.sessionCache.read() ?? { authenticated: false, user: null, shop: null },
  );
  /**
   * _loading is false immediately if we have a cached session (guard can
   * proceed without waiting).  It becomes true only while the background
   * network verify is in-flight for the first uncached boot.
   */
  private readonly _loading = signal(!this.sessionCache.read());

  readonly session         = this._session.asReadonly();
  readonly loading         = this._loading.asReadonly();
  readonly isAuthenticated = computed(() => this._session().authenticated);
  readonly currentUser     = computed(() => this._session().user);
  readonly currentShop     = computed(() => this._session().shop);
  readonly userId          = computed(() => this._session().user?.id ?? null);

  constructor() {
    // Always verify with the server in the background, even when we have a
    // cached session — this updates the cache and catches expired cookies.
    void this._verifySession();
  }

  /**
   * Network verification of the session cookie.
   * On cached boot this runs silently while the app is already visible.
   * On uncached boot _loading stays true until this resolves (guard waits).
   */
  private async _verifySession(): Promise<void> {
    try {
      const data = await this.api.get<SessionState>('/api/v1/auth/session');
      this._session.set(data);
      if (data.authenticated) {
        this.sessionCache.write(data);
        this.tokenRefresh.start();
      } else {
        this.sessionCache.clear();
        this.tokenRefresh.stop();
      }
    } catch {
      // Network error — keep the cached state rather than signing out
      // (the user may be offline; the httpOnly cookie is still valid).
      // If the cookie really is expired, the next API call will 401 and
      // the interceptor in ApiClient will attempt a refresh then sign out.
    } finally {
      this._loading.set(false);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async signUp(options: SignUpOptions): Promise<{ error: string | null }> {
    try {
      await this.api.post<{ ok: boolean; message: string }>('/api/v1/auth/signup', {
        email:    options.email,
        password: options.password,
        shopName: options.shopName,
        phone:    options.phone    ?? null,
        address:  options.address  ?? null,
      });
      return { error: null };
    } catch (err) {
      return { error: err instanceof ApiError ? err.message : 'Sign up failed.' };
    }
  }

  async signIn(options: SignInOptions): Promise<{ error: string | null }> {
    try {
      const data = await this.api.post<{ user: SessionUser; shop: SessionShop }>(
        '/api/v1/auth/signin',
        { email: options.email, password: options.password, rememberDevice: options.rememberDevice },
      );
      const state: SessionState = { authenticated: true, user: data.user, shop: data.shop };
      this._session.set(state);
      this.sessionCache.write(state);
      this.tokenRefresh.start();
      return { error: null };
    } catch (err) {
      return { error: err instanceof ApiError ? err.message : 'Sign in failed.' };
    }
  }

  async signOut(): Promise<void> {
    try { await this.api.post('/api/v1/auth/signout', {}); } catch { /* best-effort */ }
    const cleared: SessionState = { authenticated: false, user: null, shop: null };
    this._session.set(cleared);
    this.sessionCache.clear();
    this.tokenRefresh.stop();
    // Wipe all local IndexedDB data so the next user starts clean.
    void this.localDb.clearAll();
    void this.router.navigate(['/signin'], { replaceUrl: true });
  }

  async resetPassword(email: string): Promise<{ error: string | null }> {
    try {
      await this.api.post('/api/v1/auth/forgot-password', { email });
      return { error: null };
    } catch (err) {
      return { error: err instanceof ApiError ? err.message : 'Request failed.' };
    }
  }

  async resendVerification(email: string): Promise<{ error: string | null }> {
    try {
      await this.api.post('/api/v1/auth/resend-verification', { email });
      return { error: null };
    } catch (err) {
      return { error: err instanceof ApiError ? err.message : 'Request failed.' };
    }
  }

  async updatePassword(currentPassword: string, newPassword: string): Promise<{ error: string | null }> {
    try {
      await this.api.patch('/api/v1/auth/password', { currentPassword, newPassword });
      return { error: null };
    } catch (err) {
      return { error: err instanceof ApiError ? err.message : 'Password update failed.' };
    }
  }

  async exchangeToken(
    tokenHash: string,
    type: 'invite' | 'recovery' | 'email',
  ): Promise<{ user: SessionUser; shop: SessionShop | null; error: string | null }> {
    try {
      const data = await this.api.post<{ ok: boolean; user: SessionUser; shop: SessionShop | null }>(
        '/api/v1/auth/exchange-token', { tokenHash, type },
      );
      const state: SessionState = { authenticated: true, user: data.user, shop: data.shop };
      this._session.set(state);
      this.sessionCache.write(state);
      this.tokenRefresh.start();
      return { user: data.user, shop: data.shop, error: null };
    } catch (err) {
      return { user: { id: '' }, shop: null, error: err instanceof ApiError ? err.message : 'Token exchange failed.' };
    }
  }

  async verifyEmail(
    tokenHash: string,
  ): Promise<{ user: SessionUser; shop: SessionShop | null; error: string | null }> {
    try {
      const data = await this.api.post<{ ok: boolean; user: SessionUser; shop: SessionShop | null }>(
        '/api/v1/auth/verify-email', { tokenHash },
      );
      const state: SessionState = { authenticated: true, user: data.user, shop: data.shop };
      this._session.set(state);
      this.sessionCache.write(state);
      this.tokenRefresh.start();
      return { user: data.user, shop: data.shop, error: null };
    } catch (err) {
      return { user: { id: '' }, shop: null, error: err instanceof ApiError ? err.message : 'Email verification failed.' };
    }
  }

  async setPassword(newPassword: string): Promise<{ error: string | null }> {
    try {
      await this.api.patch('/api/v1/auth/set-password', { newPassword });
      return { error: null };
    } catch (err) {
      return { error: err instanceof ApiError ? err.message : 'Failed to set password.' };
    }
  }

  /** Called by the 401 interceptor. Returns true if refresh succeeded. */
  async refreshToken(): Promise<boolean> {
    try {
      await this.api.post('/api/v1/auth/refresh', {});
      // Reschedule the proactive timer after a reactive refresh.
      this.tokenRefresh.start();
      return true;
    } catch {
      return false;
    }
  }

  ngOnDestroy(): void {
    this.tokenRefresh.stop();
  }
}
