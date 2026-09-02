/**
 * shop.store.ts — server-first signal store for the shop profile.
 *
 * Every load fetches fresh data from GET /api/v1/settings.
 * No IndexedDB, no local cache.
 */
import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiClient } from './api.client';

export interface ShopProfile {
  id:                  string;
  shopName:            string;
  phone:               string | null;
  address:             string | null;
  paymentQrDataUri:    string | null;
  autoExportFrequency: string;
  autoPrintReceipt:    boolean;
  receiptFooterMessage: string | null;
}

@Injectable({ providedIn: 'root' })
export class ShopStore {
  private readonly api = inject(ApiClient);

  private readonly _shop    = signal<ShopProfile | null>(null);
  private readonly _loading = signal(false);
  private readonly _error   = signal<string | null>(null);

  readonly shop     = this._shop.asReadonly();
  readonly loading  = this._loading.asReadonly();
  readonly error    = this._error.asReadonly();
  readonly shopId   = computed(() => this._shop()?.id ?? null);
  readonly shopName = computed(() => this._shop()?.shopName ?? '');
  readonly paymentQrDataUri = computed(() => this._shop()?.paymentQrDataUri ?? null);

  private _loadPromise: Promise<void> | null = null;

  async load(): Promise<void> {
    // Deduplicate concurrent calls — layout and dashboard both call load().
    if (this._loadPromise) return this._loadPromise;
    this._loadPromise = this._doLoad().finally(() => { this._loadPromise = null; });
    return this._loadPromise;
  }

  private async _doLoad(): Promise<void> {
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

  /** Optimistic in-memory patch — applied immediately, server call is the caller's job. */
  patch(partial: Partial<ShopProfile> | Record<string, unknown>): void {
    const current = this._shop();
    if (!current) return;
    this._shop.set({ ...current, ...(partial as Partial<ShopProfile>) });
  }

  clear(): void {
    this._shop.set(null);
  }
}
