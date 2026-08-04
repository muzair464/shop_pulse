import {
  Component, inject, signal, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  Save, Loader2, Eye, EyeOff, Trash2, Upload, Download, Printer, Shield, Monitor,
} from 'lucide-angular';
import { ShopStore } from '../../core/shop.store';
import { AuthService } from '../../core/auth.service';
import { ApiClient, ApiError } from '../../core/api.client';
import { ToastService } from '../../core/toast.service';
import { ExportCsvButtonComponent } from '../../shared/export-csv-button.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, LucideAngularModule, ExportCsvButtonComponent],
  template: `
    <div class="max-w-2xl mx-auto space-y-6">
      <div class="mb-6">
        <h1 class="text-xl font-bold text-gray-900">Settings</h1>
        <p class="mt-0.5 text-sm text-gray-500">Manage your shop configuration</p>
      </div>

      <!-- Store Profile -->
      <div class="card p-6">
        <h2 class="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <lucide-icon [img]="MonitorIcon" size="16" class="text-gray-400" aria-hidden="true" />
          Store Profile
        </h2>
        <form [formGroup]="profileForm" (ngSubmit)="saveProfile()" class="space-y-4">
          <div>
            <label for="shop-name" class="block text-sm font-medium text-gray-700 mb-1.5">Shop Name</label>
            <input id="shop-name" type="text" formControlName="shopName" class="form-input" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="shop-phone" class="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input id="shop-phone" type="tel" formControlName="phone" class="form-input" placeholder="+92-300-…" />
            </div>
            <div>
              <label for="shop-addr" class="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
              <input id="shop-addr" type="text" formControlName="address" class="form-input" placeholder="Shop address" />
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" (click)="resetProfile()" class="btn-secondary">Discard</button>
            <button type="submit" class="btn-primary" [disabled]="profileSaving()">
              @if (profileSaving()) { <lucide-icon [img]="Loader2Icon" size="14" class="animate-spin" aria-hidden="true" /> }
              @else { <lucide-icon [img]="SaveIcon" size="14" aria-hidden="true" /> }
              Save Profile
            </button>
          </div>
        </form>
      </div>

      <!-- Change Password -->
      <div class="card p-6">
        <h2 class="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <lucide-icon [img]="ShieldIcon" size="16" class="text-gray-400" aria-hidden="true" />
          Change Password
        </h2>
        <form [formGroup]="passwordForm" (ngSubmit)="changePassword()" class="space-y-4">
          <div>
            <label for="cur-pass" class="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
            <input id="cur-pass" type="password" formControlName="currentPassword"
              class="form-input" placeholder="Your current password" />
          </div>
          <div>
            <label for="new-pass" class="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
            <div class="relative">
              <input id="new-pass" [type]="showNewPass() ? 'text' : 'password'"
                formControlName="newPassword" class="form-input pr-10" placeholder="At least 8 characters" />
              <button type="button" (click)="toggleShowNewPass()"
                class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                [attr.aria-label]="showNewPass() ? 'Hide password' : 'Show password'">
                <lucide-icon [img]="showNewPass() ? EyeOffIcon : EyeIcon" size="15" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div>
            <label for="confirm-pass" class="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
            <input id="confirm-pass" type="password" formControlName="confirmPassword" class="form-input" />
          </div>
          @if (passwordError()) {
            <p class="text-sm text-red-600" role="alert">{{ passwordError() }}</p>
          }
          <div class="flex justify-end">
            <button type="submit" class="btn-primary" [disabled]="passwordSaving()">
              @if (passwordSaving()) { <lucide-icon [img]="Loader2Icon" size="14" class="animate-spin" aria-hidden="true" /> }
              Update Password
            </button>
          </div>
        </form>
      </div>

      <!-- Payment QR -->
      <div class="card p-6">
        <h2 class="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
          <lucide-icon [img]="UploadIcon" size="16" class="text-gray-400" aria-hidden="true" />
          Digital Pay QR Code
        </h2>
        <p class="text-xs text-gray-400 mb-4">Shown to customers when they choose Digital Pay at checkout.</p>
        @if (qrPreviewUrl()) {
          <img [src]="qrPreviewUrl()!" alt="Payment QR" class="mb-3 max-w-[160px] rounded-lg border border-gray-200" />
        }
        <div class="flex items-center gap-2">
          <label class="btn-secondary cursor-pointer">
            <lucide-icon [img]="UploadIcon" size="14" aria-hidden="true" />
            {{ qrPreviewUrl() ? 'Replace QR' : 'Upload QR' }}
            <input type="file" accept="image/*" class="sr-only" (change)="onQrFileChange($event)" aria-label="Upload QR code image" />
          </label>
          @if (qrPreviewUrl()) {
            <button type="button" (click)="deleteQr()" class="btn-danger" [disabled]="qrSaving()">
              @if (qrSaving()) { <lucide-icon [img]="Loader2Icon" size="14" class="animate-spin" aria-hidden="true" /> }
              @else { <lucide-icon [img]="Trash2Icon" size="14" aria-hidden="true" /> }
              Remove
            </button>
          }
        </div>
      </div>

      <!-- Data Export -->
      <div class="card p-6">
        <h2 class="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
          <lucide-icon [img]="DownloadIcon" size="16" class="text-gray-400" aria-hidden="true" />
          Data Export
        </h2>
        <p class="text-xs text-gray-400 mb-4">Download a full backup of your shop data.</p>
        <div class="flex flex-wrap gap-2">
          <app-export-csv-button apiPath="/api/v1/backup/export"    label="Export Full Backup (JSON)" />
          <app-export-csv-button apiPath="/api/v1/inventory/export" label="Inventory CSV" />
          <app-export-csv-button apiPath="/api/v1/orders/export"    label="Orders CSV" />
        </div>
        <div class="mt-4">
          <label for="auto-export" class="block text-sm font-medium text-gray-700 mb-1.5">
            Scheduled Export Frequency
          </label>
          <select id="auto-export" [value]="autoExportFrequency()"
            (change)="updateAutoExport($event)" class="form-input w-48">
            <option value="never">Never</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly (Monday)</option>
            <option value="monthly">Monthly (1st)</option>
          </select>
        </div>
      </div>

      <!-- Hardware Setup -->
      <div class="card p-6">
        <h2 class="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <lucide-icon [img]="PrinterIcon" size="16" class="text-gray-400" aria-hidden="true" />
          Hardware Setup
        </h2>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-700">Auto-print receipt on sale</p>
            <p class="text-xs text-gray-400">Automatically triggers window.print() after each POS sale.</p>
          </div>
          <button type="button" role="switch" [attr.aria-checked]="autoPrintReceipt()"
            (click)="toggleAutoPrint()"
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            [class.bg-primary-600]="autoPrintReceipt()" [class.bg-gray-200]="!autoPrintReceipt()">
            <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
              [class.translate-x-6]="autoPrintReceipt()" [class.translate-x-1]="!autoPrintReceipt()">
            </span>
          </button>
        </div>
      </div>
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  private readonly shopStore = inject(ShopStore);
  private readonly auth      = inject(AuthService);
  private readonly api       = inject(ApiClient);
  private readonly toast     = inject(ToastService);
  private readonly fb        = inject(FormBuilder);

  readonly SaveIcon      = Save;
  readonly Loader2Icon   = Loader2;
  readonly EyeIcon       = Eye;
  readonly EyeOffIcon    = EyeOff;
  readonly Trash2Icon    = Trash2;
  readonly UploadIcon    = Upload;
  readonly DownloadIcon  = Download;
  readonly PrinterIcon   = Printer;
  readonly ShieldIcon    = Shield;
  readonly MonitorIcon   = Monitor;

  readonly profileSaving       = signal(false);
  readonly passwordSaving      = signal(false);
  readonly passwordError       = signal<string | null>(null);
  readonly showNewPass         = signal(false);
  readonly qrPreviewUrl        = signal<string | null>(null);
  readonly qrSaving            = signal(false);
  readonly autoPrintReceipt    = signal(true);
  readonly autoExportFrequency = signal('weekly');

  toggleShowNewPass(): void { this.showNewPass.update(v => !v); }

  readonly profileForm = this.fb.nonNullable.group({
    shopName: ['', Validators.required],
    phone:    [''],
    address:  [''],
  });

  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword:     ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  });

  async ngOnInit(): Promise<void> {
    // Step 1: populate form instantly from ShopStore (already in IDB/memory).
    this._syncFromStore();
    // Step 2: silently refresh shop data in background so we always show latest.
    void this.shopStore.load().then(() => this._syncFromStore());
  }

  /** Read current ShopStore state into the form and local signals. */
  private _syncFromStore(): void {
    const shop = this.shopStore.shop();
    if (!shop) return;
    this.profileForm.patchValue({
      shopName: shop.shopName,
      phone:    shop.phone    ?? '',
      address:  shop.address  ?? '',
    });
    this.qrPreviewUrl.set(shop.paymentQrDataUri);
    this.autoExportFrequency.set(shop.autoExportFrequency);
    this.autoPrintReceipt.set(shop.autoPrintReceipt);
  }

  resetProfile(): void {
    const shop = this.shopStore.shop();
    if (shop) {
      this.profileForm.patchValue({
        shopName: shop.shopName, phone: shop.phone ?? '', address: shop.address ?? '',
      });
    }
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) return;
    this.profileSaving.set(true);
    try {
      const val = this.profileForm.getRawValue();
      await this.api.patch('/api/v1/settings', {
        shopName: val.shopName, phone: val.phone || null, address: val.address || null,
      });
      this.shopStore.patch({ shopName: val.shopName, phone: val.phone || null, address: val.address || null });
      this.toast.success('Profile saved.');
    } catch { this.toast.error('Failed to save profile.'); }
    finally { this.profileSaving.set(false); }
  }

  async changePassword(): Promise<void> {
    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.getRawValue();
    if (newPassword !== confirmPassword) {
      this.passwordError.set('Passwords do not match.'); return;
    }
    if (this.passwordForm.invalid) return;

    this.passwordSaving.set(true);
    this.passwordError.set(null);
    const { error } = await this.auth.updatePassword(currentPassword, newPassword);
    this.passwordSaving.set(false);
    if (error) { this.passwordError.set(error); }
    else { this.toast.success('Password updated.'); this.passwordForm.reset(); }
  }

  onQrFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUri = e.target?.result as string;
      const [header, base64] = dataUri.split(',');
      const mimeType = header.match(/data:([^;]+)/)?.[1] ?? 'image/png';
      this.qrPreviewUrl.set(dataUri);
      this.qrSaving.set(true);
      try {
        await this.api.post('/api/v1/settings/payment-qr', { imageBase64: base64, mimeType });
        // Write through to ShopStore → IDB so QR survives refresh.
        this.shopStore.patch({ paymentQrDataUri: dataUri });
        this.toast.success('QR image saved.');
      } catch (err) {
        this.toast.error(err instanceof ApiError ? err.message : 'Failed to save QR image.');
        this.qrPreviewUrl.set(null);
      } finally { this.qrSaving.set(false); }
    };
    reader.readAsDataURL(file);
  }

  async deleteQr(): Promise<void> {
    if (!confirm('Remove the payment QR image?')) return;
    this.qrSaving.set(true);
    try {
      await this.api.delete('/api/v1/settings/payment-qr');
      this.qrPreviewUrl.set(null);
      // Write through to ShopStore → IDB.
      this.shopStore.patch({ paymentQrDataUri: null });
      this.toast.success('QR image removed.');
    } catch { this.toast.error('Failed to remove QR image.'); }
    finally { this.qrSaving.set(false); }
  }

  async updateAutoExport(event: Event): Promise<void> {
    const val = (event.target as HTMLSelectElement).value;
    this.autoExportFrequency.set(val);
    // Write through to ShopStore → IDB immediately (optimistic).
    this.shopStore.patch({ autoExportFrequency: val });
    try {
      await this.api.patch('/api/v1/settings', { autoExportFrequency: val });
      this.toast.success('Export schedule saved.');
    } catch {
      this.toast.error('Failed to update export schedule.');
      // Rollback signal (ShopStore.patch already wrote IDB; on next load server wins)
    }
  }

  async toggleAutoPrint(): Promise<void> {
    const next = !this.autoPrintReceipt();
    this.autoPrintReceipt.set(next);
    // Write through to ShopStore → IDB immediately (optimistic).
    this.shopStore.patch({ autoPrintReceipt: next });
    try {
      await this.api.patch('/api/v1/settings', { autoPrintReceipt: next });
    } catch {
      // Rollback
      this.autoPrintReceipt.set(!next);
      this.shopStore.patch({ autoPrintReceipt: !next });
      this.toast.error('Failed to update print setting.');
    }
  }
}
