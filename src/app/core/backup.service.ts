/**
 * BackupService — CSV backup downloader.
 *
 * Downloads all supported tables as individual <table>.csv files.
 * runDailyIfNeeded() runs at most once per app session (no browser storage
 * is used — localStorage has been intentionally removed from this project).
 *
 * The user can also trigger a manual backup from Settings at any time.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

// Tables exported — names match the Postgres table names exactly.
const BACKUP_TABLES = [
  'shops',
  'inventory_items',
  'orders',
  'order_items',
  'customers',
  'khata_transactions',
  'devices',
] as const;

declare const API_URL: string;

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly http = inject(HttpClient);

  private readonly base: string = (() => {
    try { return API_URL; } catch { return 'https://shop-pulse-api.vercel.app'; }
  })();

  /** True if a backup has already run during this app session. */
  private _ranThisSession = false;

  /** ISO date string of today in local timezone: YYYY-MM-DD */
  get todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /**
   * Run a backup once per session if it hasn't already fired.
   * Called automatically from the authenticated layout after sign-in.
   * Silent — no toast on success, only logs errors.
   */
  async runDailyIfNeeded(): Promise<void> {
    if (this._ranThisSession) return;
    await this.runBackup();
  }

  /**
   * Force a full backup right now.
   * Called from the Settings page "Backup Now" button.
   */
  async runBackup(): Promise<void> {
    for (const table of BACKUP_TABLES) {
      try {
        await this.downloadTable(table);
      } catch (err) {
        console.error(`[BackupService] Failed to export ${table}:`, err);
        // Continue with remaining tables even if one fails.
      }
    }
    this._ranThisSession = true;
  }

  /** Download a single table as <table>.csv */
  private async downloadTable(table: string): Promise<void> {
    const blob = await firstValueFrom(
      this.http.get(`${this.base}/api/v1/backup/csv?table=${table}`, {
        responseType:    'blob',
        withCredentials: true,
      }),
    );

    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `${table}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    // Small delay so the browser doesn't block multiple simultaneous downloads.
    await new Promise(resolve => setTimeout(resolve, 400));
  }
}
