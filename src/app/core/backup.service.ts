/**
 * BackupService — daily local-storage-backed CSV backup.
 *
 * On every app boot (via APP_INITIALIZER or direct injection), checks if a
 * backup has already been run today (local date). If not, silently downloads
 * all supported tables as individual <table>.csv files.
 *
 * The user can also trigger a manual backup from Settings at any time.
 *
 * Storage key: 'shoppulse_last_backup_date'  (ISO date string YYYY-MM-DD)
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

const STORAGE_KEY = 'shoppulse_last_backup_date';

declare const API_URL: string;

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly http = inject(HttpClient);

  private readonly base: string = (() => {
    try { return API_URL; } catch { return 'https://shop-pulse-api.vercel.app'; }
  })();

  /** ISO date string of today in local timezone: YYYY-MM-DD */
  private get todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Last backup date stored in localStorage, or null */
  get lastBackupDate(): string | null {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }

  /** True if a backup has already been run today */
  get ranToday(): boolean { return this.lastBackupDate === this.todayStr; }

  /**
   * Run the daily backup if it hasn't happened today.
   * Called automatically from AppComponent or AuthGuard after sign-in.
   * Silent — no toast on success, only logs errors.
   */
  async runDailyIfNeeded(): Promise<void> {
    if (this.ranToday) return;
    await this.runBackup();
  }

  /**
   * Force a full backup right now regardless of last-run date.
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
    // Record today's date only after all tables complete.
    try { localStorage.setItem(STORAGE_KEY, this.todayStr); } catch { /* quota */ }
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
