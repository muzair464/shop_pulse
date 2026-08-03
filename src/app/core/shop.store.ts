import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiClient } from './api.client';
import { AuthService } from './auth.service';

export interface ShopProfile {
  id: string;
  shopName: string;
  phone: string | null;
  address: string | null;
  paymentQrDataUri: string | null;
  autoExportFrequency: string;
  autoPrintReceipt: boolean;
}

/**
 * ShopStore — global signal store for the authenticated shop profile.
 *
 * Loaded once on first authenticated route activation via
 * GET /api/v1/settings (which also decodes the QR bytes into a data URI).
 * Patched by RealtimeSyncService when shop settings change.
 */
@Injectable({ providedIn: 'root' })
export class ShopStore {
  private readonly api  = inject(ApiClient);
  private readonly auth = inject(AuthService);

  private readonly _shop    = signal<ShopProfile | null>(null);
  private readonly _loading = signal(false);
  private readonly _error   = signal<string | null>(null);

  readonly shop     = this._shop.asReadonly();
  readonly loading  = this._loading.asReadonly();
  readonly error    = this._error.asReadonly();
  readonly shopId   = computed(() => this._shop()?.id ?? null);
  readonly shopName = computed(() => this._shop()?.shopName ?? '');

  /** Convenience accessor the POS component uses for QR rendering. */
  readonly paymentQrDataUri = computed(() => this._shop()?.paymentQrDataUri ?? null);

  async load(): Promise<void> {
    // Already loaded for the current user — skip re-fetch
    if (this._shop() && this.auth.isAuthenticated()) return;

    this._loading.set(true);
    this._error.set(null);
    try {
      const data = await this.api.get<ShopProfile>('/api/v1/settings');
      this._shop.set(data);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Failed to load shop.');
    } finally {
      this._loading.set(false);
    }
  }

  patch(partial: Partial<ShopProfile> | Record<string, unknown>): void {
    const current = this._shop();
    if (current) {
      this._shop.set({ ...current, ...(partial as Partial<ShopProfile>) });
    }
  }

  clear(): void {
    this._shop.set(null);
  }
}
