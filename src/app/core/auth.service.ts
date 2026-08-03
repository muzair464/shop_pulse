import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ApiClient, ApiError } from './api.client';

export interface SessionUser {
  id: string;
}

export interface SessionShop {
  id: string;
  name: string;
}

export interface SessionState {
  authenticated: boolean;
  user: SessionUser | null;
  shop: SessionShop | null;
}

export interface SignInOptions {
  email: string;
  password: string;
  rememberDevice: boolean;
}

export interface SignUpOptions {
  email:     string;
  password:  string;
  shopName:  string;
  phone?:    string;
  address?:  string;
}

/**
 * AuthService — zero Supabase SDK.
 *
 * All auth operations go through the Node.js Express backend:
 *  - Sign-up  → POST /api/v1/auth/signup        (creates user + shop, sends verification email)
 *  - Sign-in  → POST /api/v1/auth/signin        (backend sets httpOnly cookie)
 *  - Sign-out → POST /api/v1/auth/signout       (backend clears cookie)
 *  - Session  → GET  /api/v1/auth/session       (guard + bootstrap check)
 *  - Password → PATCH /api/v1/auth/password
 *  - Forgot   → POST /api/v1/auth/forgot-password
 *  - Verify   → POST /api/v1/auth/verify-email  (exchanges OTP → session cookie)
 *
 * Angular holds NO token. The httpOnly cookie is sent by the browser
 * automatically on every same-site (or credentialed cross-origin) request.
 */
@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly router = inject(Router);
  private readonly api    = inject(ApiClient);

  // ── Signals ───────────────────────────────────────────────────────────────
  private readonly _session = signal<SessionState>({
    authenticated: false,
    user: null,
    shop: null,
  });
  private readonly _loading = signal(true);

  readonly session         = this._session.asReadonly();
  readonly loading         = this._loading.asReadonly();
  readonly isAuthenticated = computed(() => this._session().authenticated);
  readonly currentUser     = computed(() => this._session().user);
  readonly currentShop     = computed(() => this._session().shop);
  readonly userId          = computed(() => this._session().user?.id ?? null);

  constructor() {
    void this.restoreSession();
  }

  /** Called on app bootstrap to see if a valid cookie already exists. */
  async restoreSession(): Promise<void> {
    try {
      const data = await this.api.get<SessionState>('/api/v1/auth/session');
      this._session.set(data);
    } catch {
      this._session.set({ authenticated: false, user: null, shop: null });
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Register a new account.
   * Backend creates the Supabase Auth user + shops row, then Supabase sends
   * a confirmation email. The user cannot sign in until they click it.
   * On success, navigate to /verify-email so they know to check their inbox.
   */
  async signUp(options: SignUpOptions): Promise<{ error: string | null }> {
    try {
      await this.api.post<{ ok: boolean; message: string }>(
        '/api/v1/auth/signup',
        {
          email:    options.email,
          password: options.password,
          shopName: options.shopName,
          phone:    options.phone    ?? null,
          address:  options.address  ?? null,
        },
      );
      return { error: null };
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Sign up failed.';
      return { error: msg };
    }
  }

  async signIn(options: SignInOptions): Promise<{ error: string | null }> {
    try {
      const data = await this.api.post<{ user: SessionUser; shop: SessionShop }>(
        '/api/v1/auth/signin',
        { email: options.email, password: options.password },
      );
      this._session.set({ authenticated: true, user: data.user, shop: data.shop });
      return { error: null };
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Sign in failed.';
      return { error: msg };
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.api.post('/api/v1/auth/signout', {});
    } catch {
      // Best-effort — clear local state regardless
    }
    this._session.set({ authenticated: false, user: null, shop: null });
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

  async updatePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ error: string | null }> {
    try {
      await this.api.patch('/api/v1/auth/password', { currentPassword, newPassword });
      return { error: null };
    } catch (err) {
      return { error: err instanceof ApiError ? err.message : 'Password update failed.' };
    }
  }

  /**
   * Exchange a Supabase OTP token_hash for a real httpOnly session cookie.
   * Used by SetPasswordComponent (invite / recovery flows).
   */
  async exchangeToken(
    tokenHash: string,
    type: 'invite' | 'recovery' | 'email',
  ): Promise<{ user: SessionUser; shop: SessionShop | null; error: string | null }> {
    try {
      const data = await this.api.post<{
        ok:   boolean;
        user: SessionUser;
        shop: SessionShop | null;
      }>('/api/v1/auth/exchange-token', { tokenHash, type });

      this._session.set({ authenticated: true, user: data.user, shop: data.shop });
      return { user: data.user, shop: data.shop, error: null };
    } catch (err) {
      return {
        user:  { id: '' },
        shop:  null,
        error: err instanceof ApiError ? err.message : 'Token exchange failed.',
      };
    }
  }

  /**
   * Exchange the email-confirmation OTP for a session cookie.
   * Called by VerifyEmailComponent when the user lands on /verify-email
   * with ?token_hash=XXX&type=email from the Supabase confirmation email.
   */
  async verifyEmail(
    tokenHash: string,
  ): Promise<{ user: SessionUser; shop: SessionShop | null; error: string | null }> {
    try {
      const data = await this.api.post<{
        ok:   boolean;
        user: SessionUser;
        shop: SessionShop | null;
      }>('/api/v1/auth/verify-email', { tokenHash });

      this._session.set({ authenticated: true, user: data.user, shop: data.shop });
      return { user: data.user, shop: data.shop, error: null };
    } catch (err) {
      return {
        user:  { id: '' },
        shop:  null,
        error: err instanceof ApiError ? err.message : 'Email verification failed.',
      };
    }
  }

  /**
   * Set a new password for the currently-authenticated session.
   * No currentPassword required — used after exchangeToken() for invite / recovery.
   */
  async setPassword(newPassword: string): Promise<{ error: string | null }> {
    try {
      await this.api.patch('/api/v1/auth/set-password', { newPassword });
      return { error: null };
    } catch (err) {
      return { error: err instanceof ApiError ? err.message : 'Failed to set password.' };
    }
  }

  /** Silently refresh the access token (called by the 401 interceptor). */
  async refreshToken(): Promise<boolean> {
    try {
      await this.api.post('/api/v1/auth/refresh', {});
      return true;
    } catch {
      return false;
    }
  }

  ngOnDestroy(): void { /* nothing to clean up */ }
}
