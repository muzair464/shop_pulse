/**
 * shop.store.ts — offline-first signal store for the shop profile.
 *
 * Boot sequence:
 *  1. Read from IndexedDB → signal populated immediately.
 *  2. Fetch fresh copy from GET /api/v1/settings in the background.
 *  3. Write updated profile back to IndexedDB.
 *
 * Settings change infrequently so we always do a full refresh (no delta).
 * The QR image is a binary blob stored as a base64 data URI — unchanged
 * between loads if the user hasn't touched it.
 */
import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiClient } from './api.client';
import { LocalDbService } from './local-db.service';
import { AuthService } from './auth.service';

export interface ShopProfile {
  id:                  string;
  shopName:            string;
  phone:               string | null;
  address:             string | null;
  paymentQrDataUri:    string | null;
  autoExportFrequency: string;
  autoPrintReceipt:    boolean;
}

@Injectable({ providedIn: 'root' })
export class ShopStore {
  private readonly api     = inject(ApiClient);
  private readonly auth    = inject(AuthService);
  private readonly localDb = inject(LocalDbService);

  private readonly _shop    = signal<ShopProfile | null>(null);
  private readonly _loading = signal(false);
  private readonly _error   = signal<string | null>(null);

  readonly shop     = this._shop.asReadonly();
  readonly loading  = this._loading.asReadonly();
  readonly error    = this._error.asReadonly();
  readonly shopId   = computed(() => this._shop()?.id ?? null);
  readonly shopName = computed(() => this._shop()?.shopName ?? '');
  readonly paymentQrDataUri = computed(() => this._shop()?.paymentQrDataUri ?? null);

  async load(): Promise<void> {
    if (this._shop() && this.auth.isAuthenticated()) return;

    // ── Step 1: instant paint from IDB ────────────────────────────────────
    const shopId = this.auth.currentShop()?.id;
    if (shopId) {
      const cached = await this.localDb.getShop(shopId);
      if (cached) this._shop.set(cached);
    }

    // ── Step 2: refresh from network ──────────────────────────────────────
    this._loading.set(true);
    this._error.set(null);
    try {
      const data = await this.api.get<ShopProfile>('/api/v1/settings');
      this._shop.set(data);
      // ── Step 3: persist to IDB ───────────────────────────────────────────
      void this.localDb.putShop(data);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Failed to load shop.');
    } finally {
      this._loading.set(false);
    }
  }

  patch(partial: Partial<ShopProfile> | Record<string, unknown>): void {
    const current = this._shop();
    if (!current) return;
    const updated = { ...current, ...(partial as Partial<ShopProfile>) };
    this._shop.set(updated);
    void this.localDb.putShop(updated);
  }

  clear(): void {
    this._shop.set(null);
    void this.localDb.clearShop();
  }
}
