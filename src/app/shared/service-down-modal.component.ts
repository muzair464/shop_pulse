import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy, output } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import {
  LucideAngularModule, AlertTriangle, Clock, CheckCircle2, XCircle,
  Building, Smartphone, QrCode, Upload, ArrowRight, ShieldCheck, RefreshCw,
  Copy, Check, FileText
} from 'lucide-angular';
import { SubscriptionService } from '../core/subscription.service';
import { ShopStore } from '../core/shop.store';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-service-down-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, DecimalPipe, DatePipe],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-md overflow-y-auto">
      <div class="bg-white rounded-2xl shadow-2xl border border-red-200/80 max-w-3xl w-full p-6 sm:p-8 my-8 relative animate-in fade-in zoom-in-95 duration-200">
        
        <!-- Header: Service Down Notice -->
        <div class="flex items-start gap-4 pb-6 border-b border-gray-100">
          <div class="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <lucide-icon [img]="AlertTriangleIcon" size="28" />
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                Service Down
              </span>
              @if (subStatus() === 'pending_verification') {
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                  <lucide-icon [img]="ClockIcon" size="12" />
                  Verification Pending
                </span>
              }
            </div>
            <h1 class="text-2xl font-bold text-gray-900 mt-1">Monthly Subscription Expired</h1>
            <p class="text-sm text-gray-600 mt-0.5">
              Your store's monthly billing cycle has ended. Core operations (POS sales, stock changes, orders) are temporarily locked until subscription fee is renewed and verified.
            </p>
          </div>
        </div>

        @if (subStatus() === 'pending_verification') {
          <!-- Notice for pending verification -->
          <div class="my-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <lucide-icon [img]="ClockIcon" size="20" class="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 class="text-sm font-semibold text-amber-900">Your payment proof is under review</h3>
              <p class="text-xs text-amber-700 mt-0.5">
                Our verification team is reviewing your transaction ID. Once approved, all services will immediately unlock automatically.
              </p>
            </div>
            <button
              type="button"
              (click)="refreshStatus()"
              [disabled]="refreshing()"
              class="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors"
            >
              <lucide-icon [img]="RefreshCwIcon" size="13" [class.animate-spin]="refreshing()" />
              Check Status
            </button>
          </div>
        }

        <!-- 2 Column Section: Payment Instructions + Submission Form -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          
          <!-- Left: Bank & Easypaisa Transfer Details -->
          <div class="space-y-4">
            <h3 class="text-sm font-bold uppercase tracking-wider text-gray-400">Step 1: Send Payment</h3>
            
            <div class="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-4">
              <div class="flex items-center justify-between pb-3 border-b border-gray-200">
                <span class="text-xs text-gray-500 font-medium">Monthly Fee</span>
                <span class="text-lg font-extrabold text-gray-900">
                  Rs. {{ (subService.subscription()?.monthlyFee ?? 2000) | number }}
                </span>
              </div>

              <!-- Easypaisa Details -->
              <div class="p-3 bg-emerald-50/80 rounded-lg border border-emerald-200 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <lucide-icon [img]="SmartphoneIcon" size="14" />
                    Easypaisa Mobile Account
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-xs text-gray-600">Account Title:</span>
                  <span class="text-xs font-semibold text-gray-900">{{ settings()?.easypaisa_title }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-xs text-gray-600">Account No:</span>
                  <div class="flex items-center gap-1">
                    <span class="text-xs font-mono font-bold text-emerald-950">{{ settings()?.easypaisa_number }}</span>
                    <button type="button" (click)="copyText(settings()?.easypaisa_number ?? '')" class="text-gray-400 hover:text-gray-700">
                      <lucide-icon [img]="copiedField() === settings()?.easypaisa_number ? CheckIcon : CopyIcon" size="13" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Bank Transfer Details -->
              <div class="p-3 bg-blue-50/80 rounded-lg border border-blue-200 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                    <lucide-icon [img]="BuildingIcon" size="14" />
                    Bank Account Transfer
                  </span>
                  <span class="text-xs font-semibold text-blue-900">{{ settings()?.bank_name }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-xs text-gray-600">Account Title:</span>
                  <span class="text-xs font-semibold text-gray-900">{{ settings()?.account_title }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-xs text-gray-600">Account No:</span>
                  <div class="flex items-center gap-1">
                    <span class="text-xs font-mono font-bold text-blue-950">{{ settings()?.account_number }}</span>
                    <button type="button" (click)="copyText(settings()?.account_number ?? '')" class="text-gray-400 hover:text-gray-700">
                      <lucide-icon [img]="copiedField() === settings()?.account_number ? CheckIcon : CopyIcon" size="13" />
                    </button>
                  </div>
                </div>
                @if (settings()?.iban) {
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-gray-600">IBAN:</span>
                    <div class="flex items-center gap-1">
                      <span class="text-[11px] font-mono font-semibold text-blue-950">{{ settings()?.iban }}</span>
                      <button type="button" (click)="copyText(settings()?.iban ?? '')" class="text-gray-400 hover:text-gray-700">
                        <lucide-icon [img]="copiedField() === settings()?.iban ? CheckIcon : CopyIcon" size="13" />
                      </button>
                    </div>
                  </div>
                }
              </div>

              <!-- QR Code if available -->
              @if (settings()?.paymentQrDataUri) {
                <div class="text-center pt-2">
                  <span class="text-xs font-medium text-gray-500 block mb-1.5">Or Scan QR with Banking App</span>
                  <img [src]="settings()!.paymentQrDataUri" alt="Easypaisa/Bank QR" class="max-w-[130px] mx-auto rounded-lg border border-gray-300 shadow-sm" />
                </div>
              }
            </div>
          </div>

          <!-- Right: Verification Submission Form -->
          <div class="space-y-4">
            <h3 class="text-sm font-bold uppercase tracking-wider text-gray-400">Step 2: Submit Verification</h3>
            
            <form [formGroup]="paymentForm" (ngSubmit)="submitPayment()" class="p-4 rounded-xl bg-white border border-gray-200 shadow-sm space-y-3.5">
              
              <!-- Payment Method Selection -->
              <div>
                <label class="block text-xs font-semibold text-gray-700 mb-1">Paid Via</label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    (click)="setMethod('EASYPAISA')"
                    [class.border-emerald-600]="paymentForm.get('paymentMethod')?.value === 'EASYPAISA'"
                    [class.bg-emerald-50]="paymentForm.get('paymentMethod')?.value === 'EASYPAISA'"
                    class="p-2.5 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all"
                  >
                    <lucide-icon [img]="SmartphoneIcon" size="14" class="text-emerald-600" />
                    Easypaisa
                  </button>
                  <button
                    type="button"
                    (click)="setMethod('BANK')"
                    [class.border-blue-600]="paymentForm.get('paymentMethod')?.value === 'BANK'"
                    [class.bg-blue-50]="paymentForm.get('paymentMethod')?.value === 'BANK'"
                    class="p-2.5 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all"
                  >
                    <lucide-icon [img]="BuildingIcon" size="14" class="text-blue-600" />
                    Bank Account
                  </button>
                </div>
              </div>

              <!-- Transaction ID (TRX ID) -->
              <div>
                <label for="trxId" class="block text-xs font-semibold text-gray-700 mb-1">
                  Transaction ID / TRX ID <span class="text-red-500">*</span>
                </label>
                <input
                  id="trxId"
                  type="text"
                  formControlName="transactionId"
                  placeholder="e.g. 29384710293 or FT230981"
                  class="form-input text-xs"
                />
                <p class="text-[11px] text-gray-400 mt-1">Found in your SMS receipt or banking app confirmation.</p>
              </div>

              <!-- Sender Account or Mobile No -->
              <div>
                <label for="senderAcc" class="block text-xs font-semibold text-gray-700 mb-1">
                  Your Account / Mobile No (Sender)
                </label>
                <input
                  id="senderAcc"
                  type="text"
                  formControlName="senderAccount"
                  placeholder="e.g. 0301-9876543 or Acc Title"
                  class="form-input text-xs"
                />
              </div>

              <!-- Screenshot Upload -->
              <div>
                <label class="block text-xs font-semibold text-gray-700 mb-1">
                  Screenshot / Receipt (Optional)
                </label>
                <div class="flex items-center gap-2">
                  <label class="btn-secondary text-xs cursor-pointer py-1.5 px-3">
                    <lucide-icon [img]="UploadIcon" size="14" />
                    {{ receiptPreview() ? 'Change Screenshot' : 'Upload Screenshot' }}
                    <input type="file" accept="image/*" class="sr-only" (change)="onFileChange($event)" />
                  </label>
                  @if (receiptPreview()) {
                    <span class="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                      <lucide-icon [img]="CheckIcon" size="12" /> Attached
                    </span>
                  }
                </div>
              </div>

              <!-- Submit button -->
              <div class="pt-2">
                <button
                  type="submit"
                  [disabled]="submitting() || paymentForm.invalid"
                  class="w-full btn-primary py-2.5 text-xs font-bold justify-center shadow-md bg-gradient-to-r from-primary-600 to-primary-700"
                >
                  @if (submitting()) {
                    <lucide-icon [img]="RefreshCwIcon" size="14" class="animate-spin" />
                    Submitting Verification...
                  } @else {
                    <lucide-icon [img]="ShieldCheckIcon" size="14" />
                    Submit Payment for Verification
                  }
                </button>
              </div>

            </form>
          </div>

        </div>

      </div>
    </div>
  `,
})
export class ServiceDownModalComponent implements OnInit {
  readonly subService = inject(SubscriptionService);
  private readonly shopStore = inject(ShopStore);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly AlertTriangleIcon = AlertTriangle;
  readonly ClockIcon = Clock;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly XCircleIcon = XCircle;
  readonly BuildingIcon = Building;
  readonly SmartphoneIcon = Smartphone;
  readonly QrCodeIcon = QrCode;
  readonly UploadIcon = Upload;
  readonly ArrowRightIcon = ArrowRight;
  readonly ShieldCheckIcon = ShieldCheck;
  readonly RefreshCwIcon = RefreshCw;
  readonly CopyIcon = Copy;
  readonly CheckIcon = Check;
  readonly FileTextIcon = FileText;

  readonly submitting = signal(false);
  readonly refreshing = signal(false);
  readonly copiedField = signal<string | null>(null);
  readonly receiptPreview = signal<string | null>(null);

  readonly subStatus = computed(() => this.subService.subscription()?.status ?? 'expired');
  readonly settings = computed(() => this.subService.systemSettings());

  readonly paymentForm = this.fb.nonNullable.group({
    amount: [2000, [Validators.required, Validators.min(1)]],
    paymentMethod: ['EASYPAISA' as 'EASYPAISA' | 'BANK', Validators.required],
    transactionId: ['', [Validators.required, Validators.minLength(3)]],
    senderAccount: [''],
    notes: [''],
  });

  async ngOnInit(): Promise<void> {
    await this.subService.load();
    const fee = this.subService.subscription()?.monthlyFee ?? 2000;
    this.paymentForm.patchValue({ amount: fee });
  }

  setMethod(method: 'EASYPAISA' | 'BANK'): void {
    this.paymentForm.patchValue({ paymentMethod: method });
  }

  copyText(text: string): void {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    this.copiedField.set(text);
    this.toast.success('Copied to clipboard');
    setTimeout(() => this.copiedField.set(null), 2000);
  }

  onFileChange(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.receiptPreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async submitPayment(): Promise<void> {
    if (this.paymentForm.invalid) return;
    this.submitting.set(true);

    try {
      const val = this.paymentForm.getRawValue();
      await this.subService.submitPayment({
        amount: val.amount,
        paymentMethod: val.paymentMethod,
        transactionId: val.transactionId,
        senderAccount: val.senderAccount || null,
        notes: val.notes || null,
        receiptBase64: this.receiptPreview(),
      });

      this.toast.success('Payment submitted for verification. Please wait for confirmation.');
      this.paymentForm.reset({
        amount: this.subService.subscription()?.monthlyFee ?? 2000,
        paymentMethod: 'EASYPAISA',
        transactionId: '',
        senderAccount: '',
        notes: '',
      });
      this.receiptPreview.set(null);
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      this.submitting.set(false);
    }
  }

  async refreshStatus(): Promise<void> {
    this.refreshing.set(true);
    try {
      await this.subService.load();
      await this.shopStore.load();
      if (!this.subService.isDown()) {
        this.toast.success('Subscription verified! Welcome back.');
      } else {
        this.toast.info('Status updated.');
      }
    } finally {
      this.refreshing.set(false);
    }
  }
}
