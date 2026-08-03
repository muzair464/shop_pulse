import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiClient } from './api.client';
import type { OrderRow } from './database.types';

export interface OrderWithItems extends OrderRow {
  order_items: Array<{
    id: string;
    inventory_item_id: string | null;
    name_snapshot: string;
    qty: number;
    unit_price: number;
    line_total: number;
  }>;
}

/**
 * OrdersStore — signal store for orders.
 *
 * Populated by GET /api/v1/orders on route load.
 * Kept live by RealtimeSyncService on INSERT events.
 */
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
    return this._orders().filter(
      o => new Date(o.created_at).toDateString() === today,
    ).length;
  });

  readonly todaysRevenue = computed(() => {
    const today = new Date().toDateString();
    return this._orders()
      .filter(o => new Date(o.created_at).toDateString() === today)
      .reduce((s, o) => s + Number(o.total), 0);
  });

  async load(_shopId: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const data = await this.api.get<OrderRow[]>('/api/v1/orders');
      this._orders.set(data ?? []);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Failed to load orders.');
    } finally {
      this._loading.set(false);
    }
  }

  prependOrder(order: OrderRow): void {
    this._orders.update(orders => [order, ...orders]);
  }

  clear(): void {
    this._orders.set([]);
  }
}
