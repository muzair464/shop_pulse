import { Injectable, inject, OnDestroy } from '@angular/core';
import { AuthService } from './auth.service';
import { ShopStore } from './shop.store';
import { InventoryStore } from './inventory.store';
import { OrdersStore } from './orders.store';
import type { InventoryItemRow, OrderRow } from './database.types';

// Injected at build time via angular.json define. Falls back to localhost for ng serve.
declare const API_URL: string;
function getApiUrl(): string {
  try { return API_URL; } catch { return 'http://localhost:3000'; }
}

/**
 * RealtimeSyncService — root-provided; one native WebSocket per authenticated session.
 *
 * Replaces the old Supabase Realtime channel. The Python backend pushes
 * JSON messages over /api/v1/ws/sync whenever inventory, orders or shop
 * data changes (via Postgres LISTEN/NOTIFY → ConnectionManager.broadcast).
 *
 * Message shapes pushed by the backend:
 *   { table: 'inventory_items', op: 'INSERT'|'UPDATE'|'DELETE', row: {...} }
 *   { table: 'orders',          op: 'INSERT',                   row: {...} }
 *   { table: 'shops',           op: 'UPDATE',                   row: {...} }
 *   { type: 'session_revoked' }
 *
 * On reconnect, performs a full re-fetch as a correctness backstop.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeSyncService implements OnDestroy {
  private readonly auth         = inject(AuthService);
  private readonly shopStore    = inject(ShopStore);
  private readonly inventoryStore = inject(InventoryStore);
  private readonly ordersStore  = inject(OrdersStore);

  private ws: WebSocket | null = null;
  private shopId = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private stopped = false;

  /** Build the WebSocket URL from the API base URL (http → ws, https → wss). */
  private get wsUrl(): string {
    const base = getApiUrl().replace(/^http/, 'ws');
    return `${base}/api/v1/ws/sync`;
  }

  start(shopId: string): void {
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;
    this.shopId = shopId;
    this.stopped = false;
    this._connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // prevent auto-reconnect on intentional close
      this.ws.close();
      this.ws = null;
    }
  }

  private _connect(): void {
    if (this.stopped) return;

    const ws = new WebSocket(this.wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectDelay = 1000; // reset backoff
      // Re-fetch all stores on (re)connect as a correctness backstop
      void this._refetchAll();
      // Start heartbeat ping every 25 s to keep the connection alive
      this._startHeartbeat(ws);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as Record<string, unknown>;
        this._handleMessage(msg);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => {
      // error always precedes close — let onclose handle reconnect
    };

    ws.onclose = () => {
      this._scheduleReconnect();
    };
  }

  private _handleMessage(msg: Record<string, unknown>): void {
    // Device revocation — force immediate sign-out
    if (msg['type'] === 'session_revoked') {
      void this.auth.signOut();
      return;
    }

    const table = msg['table'] as string | undefined;
    const op    = msg['op']    as string | undefined;
    const row   = msg['row']   as Record<string, unknown> | null | undefined;

    if (!table || !op) return;

    switch (table) {
      case 'inventory_items':
        if (op === 'DELETE') {
          if (row?.['id']) this.inventoryStore.removeItem(row['id'] as string);
        } else if (row) {
          this.inventoryStore.upsertItem(row as unknown as InventoryItemRow);
        }
        break;

      case 'orders':
        if (op === 'INSERT' && row) {
          this.ordersStore.prependOrder(row as unknown as OrderRow);
        }
        break;

      case 'shops':
        if (row) {
          this.shopStore.patch(row as Record<string, unknown>);
        }
        break;
    }
  }

  private _scheduleReconnect(): void {
    if (this.stopped) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
      this._connect();
    }, this.reconnectDelay);
  }

  private _startHeartbeat(ws: WebSocket): void {
    const id = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('ping');
      } else {
        clearInterval(id);
      }
    }, 25_000);
  }

  private async _refetchAll(): Promise<void> {
    await Promise.all([
      this.inventoryStore.load(this.shopId),
      this.ordersStore.load(this.shopId),
      this.shopStore.load(),
    ]);
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
