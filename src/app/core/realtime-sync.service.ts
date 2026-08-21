/**
 * realtime-sync.service.ts
 *
 * Connects to the Node.js backend's native WebSocket at /api/v1/ws/sync.
 * No Supabase SDK, no Supabase Realtime, no browser storage.
 *
 * Message types from the server:
 *  { type: 'change', table: string, op: string, id: string, row?: unknown }
 *  { type: 'session_revoked' }
 *
 * On reconnect, all stores are reloaded from the server to recover any
 * changes that arrived while the socket was disconnected.
 */
import { Injectable, inject, OnDestroy } from '@angular/core';
import { AuthService } from './auth.service';
import { ShopStore } from './shop.store';
import { InventoryStore } from './inventory.store';
import { OrdersStore } from './orders.store';
import type { InventoryItemRow, OrderRow } from './database.types';

declare const API_URL: string;

function getApiUrl(): string {
  try { return API_URL; } catch { return 'https://shop-pulse-api.vercel.app'; }
}

/** Convert an HTTP(S) base URL to its WS(S) equivalent. */
function toWsUrl(base: string, path: string): string {
  return base.replace(/^http/, 'ws').replace(/\/$/, '') + path;
}

interface WsMessage {
  type:   'change' | 'session_revoked' | 'ping';
  table?: string;
  op?:    string;
  id?:    string;
  row?:   unknown;
}

const INITIAL_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS     = 30_000;

@Injectable({ providedIn: 'root' })
export class RealtimeSyncService implements OnDestroy {
  private readonly auth           = inject(AuthService);
  private readonly shopStore      = inject(ShopStore);
  private readonly inventoryStore = inject(InventoryStore);
  private readonly ordersStore    = inject(OrdersStore);

  private ws:              WebSocket | null = null;
  private shopId           = '';
  private reconnectDelay   = INITIAL_RECONNECT_MS;
  private reconnectTimer:  ReturnType<typeof setTimeout> | null = null;
  private stopped          = false;

  /** Call once after sign-in. shopId is used to scope refetch calls. */
  start(shopId: string, _deviceId?: string): void {
    if (this.ws) return; // already running
    this.shopId  = shopId;
    this.stopped = false;
    this._connect();
  }

  stop(): void {
    this.stopped = true;
    this._clearReconnectTimer();
    if (this.ws) {
      this.ws.onclose = null; // prevent auto-reconnect on intentional close
      this.ws.close();
      this.ws = null;
    }
  }

  // ── WebSocket lifecycle ───────────────────────────────────────────────────

  private _connect(): void {
    const url = toWsUrl(getApiUrl(), '/api/v1/ws/sync');
    const ws  = new WebSocket(url);
    this.ws   = ws;

    ws.onopen = () => {
      this.reconnectDelay = INITIAL_RECONNECT_MS;
      // Refetch all stores once connected — recovers any changes missed
      // while disconnected.
      void this._refetchAll();
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        this._handleMessage(msg);
      } catch { /* malformed frame — ignore */ }
    };

    ws.onerror = () => {
      // onerror is always followed by onclose — let onclose handle reconnect.
    };

    ws.onclose = () => {
      this.ws = null;
      if (!this.stopped) this._scheduleReconnect();
    };
  }

  private _scheduleReconnect(): void {
    this._clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.stopped) this._connect();
    }, this.reconnectDelay);

    // Exponential backoff capped at MAX_RECONNECT_MS.
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_MS);
  }

  private _clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ── Message handling ──────────────────────────────────────────────────────

  private _handleMessage(msg: WsMessage): void {
    if (msg.type === 'session_revoked') {
      void this.auth.signOut();
      return;
    }

    if (msg.type === 'ping') return;

    if (msg.type === 'change') {
      switch (msg.table) {
        case 'inventory_items':
          if (msg.op === 'DELETE') {
            if (msg.id) this.inventoryStore.removeItem(msg.id);
          } else if (msg.row) {
            this.inventoryStore.upsertItem(msg.row as InventoryItemRow);
          }
          break;

        case 'orders':
          if (msg.op === 'INSERT' && msg.row) {
            this.ordersStore.prependOrder(msg.row as OrderRow);
          }
          break;

        case 'shops':
          if (msg.row) {
            this.shopStore.patch(msg.row as Record<string, unknown>);
          }
          break;
      }
    }
  }

  /** Full reload of all stores from the server. */
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
