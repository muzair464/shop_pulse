/**
 * realtime-sync.service.ts
 *
 * Keeps all signal stores in sync with the server.
 *
 * Strategy: periodic polling via the standard REST endpoints.
 * The backend runs on Vercel serverless (Next.js), which cannot host a
 * persistent WebSocket. Polling every 15 seconds gives near-realtime
 * consistency for a single-shop, moderate-traffic POS without needing
 * a separate always-on WebSocket server.
 *
 * If a future always-on backend is added, swap _startPolling for a
 * WebSocket connect — the store interfaces are identical.
 */
import { Injectable, inject, OnDestroy } from '@angular/core';
import { AuthService } from './auth.service';
import { ShopStore } from './shop.store';
import { InventoryStore } from './inventory.store';
import { OrdersStore } from './orders.store';

const POLL_INTERVAL_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class RealtimeSyncService implements OnDestroy {
  private readonly auth           = inject(AuthService);
  private readonly shopStore      = inject(ShopStore);
  private readonly inventoryStore = inject(InventoryStore);
  private readonly ordersStore    = inject(OrdersStore);

  private shopId      = '';
  private pollTimer:  ReturnType<typeof setInterval> | null = null;

  /** Call once after sign-in. shopId is kept for store.load() calls. */
  start(shopId: string, _deviceId?: string): void {
    if (this.pollTimer) return; // already running
    this.shopId = shopId;
    this._startPolling();
  }

  stop(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.shopId = '';
  }

  // ── Polling ───────────────────────────────────────────────────────────────

  private _startPolling(): void {
    this.pollTimer = setInterval(() => {
      void this._poll();
    }, POLL_INTERVAL_MS);
  }

  private async _poll(): Promise<void> {
    // Only poll if the user is still authenticated.
    if (!this.auth.isAuthenticated()) { this.stop(); return; }

    await Promise.allSettled([
      this.inventoryStore.load(this.shopId),
      this.ordersStore.load(this.shopId),
      this.shopStore.load(),
    ]);
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
