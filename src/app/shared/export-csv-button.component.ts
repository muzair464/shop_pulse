import { Component, input, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { LucideAngularModule, Download, Loader2 } from 'lucide-angular';
import { ApiClient, ApiError } from '../core/api.client';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-export-csv-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <button
      type="button"
      (click)="download()"
      [disabled]="loading()"
      class="btn-secondary"
      [attr.aria-busy]="loading()"
      [attr.aria-label]="label()"
    >
      @if (loading()) {
        <lucide-icon [img]="Loader2Icon" size="15" class="animate-spin" aria-hidden="true" />
      } @else {
        <lucide-icon [img]="DownloadIcon" size="15" aria-hidden="true" />
      }
      {{ loading() ? 'Exporting…' : label() }}
    </button>
  `,
})
export class ExportCsvButtonComponent {
  /** API path to hit, e.g. '/api/v1/inventory/export' */
  readonly apiPath = input.required<string>();
  readonly label = input<string>('Export CSV');
  readonly filename = input<string | undefined>(undefined);

  readonly loading = signal(false);

  readonly DownloadIcon = Download;
  readonly Loader2Icon = Loader2;

  private readonly api = inject(ApiClient);
  private readonly toast = inject(ToastService);

  async download(): Promise<void> {
    this.loading.set(true);
    try {
      await this.api.download(this.apiPath(), this.filename());
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Export failed. Please try again.';
      this.toast.error(msg);
    } finally {
      this.loading.set(false);
    }
  }
}
