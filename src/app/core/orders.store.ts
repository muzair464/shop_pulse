/**
 * orders.store.ts — offline-first signal store for orders.
 *
 * Boot sequence:
 *  1. Read IndexedDB → _orders signal populated immediately (0 ms).
 *  2. Read last sync cursor (ISO timestamp of newest cached order).
 *  3. Fetch only orders with created_at > cursor from the API (delta sync).
 *     On first boot (empty IDB) this fetches the full history.
 *  4. Merge new orders into IDB and prepend to signal.
 *
 * Orders are append-only — they are never edited after creation —
 * so a simple createdAfter cursor is sufficient; no UPDATE tracking needed.
 *
 * Realtime (INSERT events from RealtimeSyncService) also writes through
 * to IDB so new orders appear instantly and survive the next refresh.
 */
import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiClient } from './api.client';
import { LocalDbService } from './local-db.service';
import type { OrderRow } from './database.types';

const SYNC_KEY = 'orders';

export interface OrderWithItems extends OrderRow {
  order_items: Array<{
    id:                string;
    inventory_item_id: string | null;
    name_snapshot:     string;
    description:       string | null;
    qty:               number;
    unit_price:        number;
    line_total:        number;
  }>;
}

@Injectable({ providedIn: 'root' })
export class OrdersStore {
  private readonly api     = inject(ApiClient);
  private readonly localDb = inject(LocalDbService);

  private readonly _orders  = signal<OrderRow[]>([]);
  private readonly _loading = signal(false);
  private readonly _error   = signal<string | null>(null);

  readonly orders  = this._orders.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error   = this._error.asReadonly();

  readonly todaysOrderCount = computed(() => {
    const today = new Date().toDateString();
    return this._orders().filter(o => new Date(o.created_at).toDateString() === today).length;
  });

  readonly todaysRevenue = computed(() => {
    const today = new Date().toDateString();
    return this._orders()
      .filter(o => new Date(o.created_at).toDateString() === today)
      .reduce((s, o) => s + Number(o.total), 0);
  });

  readonly totalRevenue = computed(() =>
    this._orders().reduce((s, o) => s + Number(o.total), 0),
  );

  readonly totalOrderCount = computed(() => this._orders().length);

  readonly avgOrderValue = computed(() => {
    const count = this._orders().length;
    return count === 0 ? 0 : this.totalRevenue() / count;
  });

  readonly totalDiscount = computed(() =>
    this._orders().reduce((s, o) => s + Number(o.discount), 0),
  );

  /**
   * Load orders using offline-first + delta sync strategy.
   * @param _shopId  Kept for API compatibility — not sent in request (RLS handles it).
   * @param force    When true, ignores lastSyncAt and fetches full history.
   */
  async load(_shopId: string, force = false): Promise<void> {
    // ── Step 1: instant UI from IndexedDB ─────────────────────────────────
    const cached = await this.localDb.getAllOrders();
    if (cached.length > 0) {
      this._orders.set(cached);
    }

    // ── Step 2 + 3: fetch only new orders since last sync ─────────────────
    this._loading.set(true);
    this._error.set(null);
    try {
      const lastSyncAt = force ? null : await this.localDb.getLastSyncAt(SYNC_KEY);
      const url = lastSyncAt
        ? `/api/v1/orders?createdAfter=${encodeURIComponent(lastSyncAt)}`
        : '/api/v1/orders';

      const response = await this.api.get<{ orders: OrderRow[]; syncedAt: string }>(url);

      if (response.orders.length > 0) {
        // ── Step 4: merge into IDB then rebuild signal from IDB ──────────
        await this.localDb.bulkUpsertOrders(response.orders);
        const all = await this.localDb.getAllOrders(); // already sorted newest-first
        this._orders.set(all);
      }

      // Advance cursor even when no new orders arrived.
      await this.localDb.setLastSyncAt(SYNC_KEY, response.syncedAt);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Failed to sync orders.');
      // Non-fatal — the UI already shows cached data.
    } finally {
      this._loading.set(false);
    }
  }

  /** Called by RealtimeSyncService on INSERT events and by POS after checkout. */
  prependOrder(order: OrderRow): void {
    this._orders.update(orders => [order, ...orders]);
    void this.localDb.prependOrder(order);
  }

  clear(): void {
    this._orders.set([]);
    void this.localDb.clearOrders();
  }
}
