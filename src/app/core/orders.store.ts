/**
 * orders.store.ts — server-first signal store for orders.
 *
 * Every load fetches directly from the API. No IndexedDB, no local cache.
 * Realtime INSERT events from RealtimeSyncService prepend new orders live.
 */
import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiClient } from './api.client';
import type { OrderRow } from './database.types';

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
  private readonly api = inject(ApiClient);

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
   * Fetch all orders from the server and populate the signal.
   * @param _shopId  Kept for call-site compatibility — RLS on the backend handles scoping.
   */
  async load(_shopId: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const response = await this.api.get<{ orders: OrderRow[]; syncedAt: string }>(
        '/api/v1/orders',
      );
      this._orders.set(response.orders);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Failed to load orders.');
    } finally {
      this._loading.set(false);
    }
  }

  /** Called by RealtimeSyncService on INSERT events and by POS after checkout. */
  prependOrder(order: OrderRow): void {
    this._orders.update(orders => [order, ...orders]);
  }

  clear(): void {
    this._orders.set([]);
  }
}
