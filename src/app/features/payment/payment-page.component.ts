import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LucideAngularModule,
  Building, Smartphone, ShieldCheck, RefreshCw,
  Copy, Check, Upload, Clock, CheckCircle2, AlertTriangle,
  ArrowRight, FileText, History
} from 'lucide-angular';
import { SubscriptionService, SubscriptionPaymentRecord } from '../../core/subscription.service';
import { ToastService } from '../../core/toast.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-payment-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, DecimalPipe],
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col">

      <!-- Header bar -->
      <header class="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
            <lucide-icon [img]="ShieldCheckIcon" size="18" class="text-white" />
          </div>
          <span class="font-bold text-gray-900 text-lg">ShopPulse</span>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" (click)="toggleView()" class="text-sm text-primary-600 hover:underline font-medium flex items-center gap-1">
            @if (view() === 'pay') {
              <lucide-icon [img]="HistoryIcon" size="15" /> Payment History
            } @else {
              <lucide-icon [img]="ArrowRightIcon" size="15" /> Submit Payment
            }
          </button>
          <button type="button" (click)="signOut()" class="ml-4 text-xs text-gray-500 hover:text-gray-800">Sign out</button>
        </div>
      </header>

      <!-- Body -->
      <div class="flex-1 mx-auto w-full max-w-3xl px-4 py-8">

        <!-- Status banner -->
        @if (subStatus() === 'pending_verification') {
          <div class="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3">
            <lucide-icon [img]="ClockIcon" size="20" class="text-amber-600 shrink-0" />
            <div class="flex-1">
              <p class="text-sm font-semibold text-amber-900">Payment Under Review</p>
              <p class="text-xs text-amber-700 mt-0.5">Your payment proof has been submitted and is being verified by the admin. Services will unlock automatically once approved.</p>
            </div>
            <button type="button" (click)="refreshStatus()" [disabled]="refreshing()"
              class="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 flex items-center gap-1.5">
              <lucide-icon [img]="RefreshCwIcon" size="13" [class.animate-spin]="refreshing()" />
              Check Status
            </button>
          </div>
        } @else {
          <div class="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
            <lucide-icon [img]="AlertTriangleIcon" size="20" class="text-red-600 shrink-0 mt-0.5" />
            <div>
              <p class="text-sm font-bold text-red-900">Subscription Required</p>
              <p class="text-xs text-red-700 mt-0.5">Your shop does not have an active subscription. Please complete the payment below to unlock all features.</p>
            </div>
          </div>
        }

        <!-- Title -->
        <h1 class="text-2xl font-bold text-gray-900 mb-1">
          {{ view() === 'pay' ? 'Complete Payment' : 'Payment History' }}
        </h1>
        <p class="text-sm text-gray-500 mb-8">
          {{ view() === 'pay' ? 'Transfer the monthly fee and submit your proof of payment below.' : 'All your past payment submissions.' }}
        </p>

        <!-- PAYMENT VIEW -->
        @if (view() === 'pay') {
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

            <!-- Left: Account Details -->
            <div class="space-y-4">
              <h2 class="text-xs font-bold uppercase tracking-widest text-gray-400">Step 1 · Send Payment</h2>

              <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
                <!-- Fee -->
                <div class="flex items-center justify-between pb-3 border-b border-gray-100">
                  <span class="text-xs text-gray-500">Monthly Fee</span>
                  <span class="text-xl font-extrabold text-gray-900">
                    Rs. {{ (subService.subscription()?.monthlyFee ?? 2000) | number }}
                  </span>
                </div>

                <!-- Easypaisa -->
                @if (settings()?.easypaisa_number) {
                  <div class="p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-1.5">
                    <p class="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <lucide-icon [img]="SmartphoneIcon" size="14" />
                      Easypaisa Mobile Account
                    </p>
                    @if (settings()?.easypaisa_title) {
                      <div class="flex justify-between text-xs">
                        <span class="text-gray-500">Account Title</span>
                        <span class="font-semibold text-gray-900">{{ settings()!.easypaisa_title }}</span>
                      </div>
                    }
                    <div class="flex justify-between text-xs">
                      <span class="text-gray-500">Account No</span>
                      <div class="flex items-center gap-1">
                        <span class="font-mono font-bold text-emerald-950">{{ settings()!.easypaisa_number }}</span>
                        <button type="button" (click)="copyText(settings()!.easypaisa_number)" class="text-gray-400 hover:text-gray-700">
                          <lucide-icon [img]="copiedField() === settings()!.easypaisa_number ? CheckIcon : CopyIcon" size="13" />
                        </button>
                      </div>
                    </div>
                  </div>
                }

                <!-- Bank -->
                @if (settings()?.account_number) {
                  <div class="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-1.5">
                    <div class="flex items-center justify-between">
                      <p class="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                        <lucide-icon [img]="BuildingIcon" size="14" />
                        Bank Account Transfer
                      </p>
                      @if (settings()?.bank_name) {
                        <span class="text-xs font-semibold text-blue-900">{{ settings()!.bank_name }}</span>
                      }
                    </div>
                    @if (settings()?.account_title) {
                      <div class="flex justify-between text-xs">
                        <span class="text-gray-500">Account Title</span>
                        <span class="font-semibold text-gray-900">{{ settings()!.account_title }}</span>
                      </div>
                    }
                    <div class="flex justify-between text-xs">
                      <span class="text-gray-500">Account No</span>
                      <div class="flex items-center gap-1">
                        <span class="font-mono font-bold text-blue-950">{{ settings()!.account_number }}</span>
                        <button type="button" (click)="copyText(settings()!.account_number)" class="text-gray-400 hover:text-gray-700">
                          <lucide-icon [img]="copiedField() === settings()!.account_number ? CheckIcon : CopyIcon" size="13" />
                        </button>
                      </div>
                    </div>
                    @if (settings()?.iban) {
                      <div class="flex justify-between text-xs">
                        <span class="text-gray-500">IBAN</span>
                        <div class="flex items-center gap-1">
                          <span class="font-mono text-[11px] font-semibold text-blue-950">{{ settings()!.iban }}</span>
                          <button type="button" (click)="copyText(settings()!.iban)" class="text-gray-400 hover:text-gray-700">
                            <lucide-icon [img]="copiedField() === settings()!.iban ? CheckIcon : CopyIcon" size="13" />
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                }

                <!-- QR Code -->
                @if (settings()?.paymentQrDataUri) {
                  <div class="text-center pt-1">
                    <p class="text-xs text-gray-400 mb-2">Or scan with your banking app</p>
                    <img [src]="settings()!.paymentQrDataUri" alt="Payment QR Code"
                      class="max-w-[140px] mx-auto rounded-lg border border-gray-300 shadow-sm" />
                  </div>
                }
              </div>
            </div>

            <!-- Right: Submission Form -->
            <div class="space-y-4">
              <h2 class="text-xs font-bold uppercase tracking-widest text-gray-400">Step 2 · Submit Proof</h2>

              <form [formGroup]="paymentForm" (ngSubmit)="submitPayment()"
                class="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">

                <!-- Payment Method -->
                <div>
                  <label class="block text-xs font-semibold text-gray-700 mb-1.5">Paid Via</label>
                  <div class="grid grid-cols-2 gap-2">
                    <button type="button" (click)="setMethod('EASYPAISA')"
                      class="p-2.5 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all"
                      [class.border-emerald-500]="paymentForm.get('paymentMethod')?.value === 'EASYPAISA'"
                      [class.bg-emerald-50]="paymentForm.get('paymentMethod')?.value === 'EASYPAISA'">
                      <lucide-icon [img]="SmartphoneIcon" size="14" class="text-emerald-600" />
                      Easypaisa
                    </button>
                    <button type="button" (click)="setMethod('BANK')"
                      class="p-2.5 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all"
                      [class.border-blue-500]="paymentForm.get('paymentMethod')?.value === 'BANK'"
                      [class.bg-blue-50]="paymentForm.get('paymentMethod')?.value === 'BANK'">
                      <lucide-icon [img]="BuildingIcon" size="14" class="text-blue-600" />
                      Bank Transfer
                    </button>
                  </div>
                </div>

                <!-- TRX ID -->
                <div>
                  <label for="trxId" class="block text-xs font-semibold text-gray-700 mb-1">
                    Transaction ID <span class="text-red-500">*</span>
                  </label>
                  <input id="trxId" type="text" formControlName="transactionId"
                    placeholder="e.g. 29384710293 or FT230981"
                    class="form-input text-xs w-full" />
                  <p class="text-[11px] text-gray-400 mt-1">Found in your SMS receipt or banking app.</p>
                </div>

                <!-- Sender Account -->
                <div>
                  <label for="senderAcc" class="block text-xs font-semibold text-gray-700 mb-1">
                    Your Account / Mobile No (Sender)
                  </label>
                  <input id="senderAcc" type="text" formControlName="senderAccount"
                    placeholder="e.g. 0301-9876543"
                    class="form-input text-xs w-full" />
                </div>

                <!-- Screenshot -->
                <div>
                  <label class="block text-xs font-semibold text-gray-700 mb-1">Screenshot / Receipt (Optional)</label>
                  <div class="flex items-center gap-2">
                    <label class="btn-secondary text-xs cursor-pointer py-1.5 px-3">
                      <lucide-icon [img]="UploadIcon" size="14" />
                      {{ receiptPreview() ? 'Change' : 'Upload Screenshot' }}
                      <input type="file" accept="image/*" class="sr-only" (change)="onFileChange($event)" />
                    </label>
                    @if (receiptPreview()) {
                      <span class="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                        <lucide-icon [img]="CheckIcon" size="12" /> Attached
                      </span>
                    }
                  </div>
                </div>

                <!-- Submit -->
                <button type="submit" [disabled]="submitting() || paymentForm.invalid"
                  class="w-full btn-primary py-2.5 text-sm font-bold flex items-center justify-center gap-2">
                  @if (submitting()) {
                    <lucide-icon [img]="RefreshCwIcon" size="16" class="animate-spin" /> Submitting...
                  } @else {
                    <lucide-icon [img]="ShieldCheckIcon" size="16" /> Submit Payment for Verification
                  }
                </button>
              </form>
            </div>
          </div>
        }

        <!-- HISTORY VIEW -->
        @if (view() === 'history') {
          <div class="space-y-3">
            @if (payments().length === 0) {
              <div class="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                <lucide-icon [img]="FileTextIcon" size="40" class="mx-auto mb-3 text-gray-200" />
                <p class="font-medium">No payment history yet</p>
                <p class="text-xs mt-1">Submit your first payment to see history here.</p>
                <button type="button" (click)="view.set('pay')" class="mt-4 btn-primary text-sm">
                  Submit Payment
                </button>
              </div>
            } @else {
              @for (p of payments(); track p.id) {
                <div class="bg-white rounded-xl border p-4 shadow-sm"
                  [class.border-amber-300]="p.status === 'pending'"
                  [class.border-green-200]="p.status === 'approved'"
                  [class.border-red-200]="p.status === 'rejected'">
                  <div class="flex items-start justify-between">
                    <div>
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-semibold text-gray-900">Rs. {{ p.amount | number }}</span>
                        <span class="text-xs font-semibold px-2 py-0.5 rounded-full"
                          [class.bg-amber-100]="p.status === 'pending'"
                          [class.text-amber-800]="p.status === 'pending'"
                          [class.bg-green-100]="p.status === 'approved'"
                          [class.text-green-800]="p.status === 'approved'"
                          [class.bg-red-100]="p.status === 'rejected'"
                          [class.text-red-800]="p.status === 'rejected'">
                          {{ p.status | titlecase }}
                        </span>
                        <span class="text-xs font-semibold px-2 py-0.5 rounded-full"
                          [class.bg-emerald-100]="p.payment_method === 'EASYPAISA'"
                          [class.text-emerald-800]="p.payment_method === 'EASYPAISA'"
                          [class.bg-blue-100]="p.payment_method === 'BANK'"
                          [class.text-blue-800]="p.payment_method === 'BANK'">
                          {{ p.payment_method }}
                        </span>
                      </div>
                      <p class="text-xs text-gray-500 mt-1">TRX: <span class="font-mono font-semibold text-gray-700">{{ p.transaction_id }}</span></p>
                      @if (p.admin_notes) {
                        <p class="text-xs mt-1 text-blue-700 bg-blue-50 rounded px-2 py-1">
                          <strong>Admin:</strong> {{ p.admin_notes }}
                        </p>
                      }
                    </div>
                    <span class="text-[11px] text-gray-400 whitespace-nowrap">{{ p.created_at | date:'dd MMM, hh:mm a' }}</span>
                  </div>
                </div>
              }
            }
          </div>
        }

      </div>
    </div>
  `,
})
export class PaymentPageComponent implements OnInit {
  readonly subService = inject(SubscriptionService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly BuildingIcon     = Building;
  readonly SmartphoneIcon   = Smartphone;
  readonly ShieldCheckIcon  = ShieldCheck;
  readonly RefreshCwIcon    = RefreshCw;
  readonly CopyIcon         = Copy;
  readonly CheckIcon        = Check;
  readonly UploadIcon       = Upload;
  readonly ClockIcon        = Clock;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly AlertTriangleIcon = AlertTriangle;
  readonly ArrowRightIcon   = ArrowRight;
  readonly FileTextIcon     = FileText;
  readonly HistoryIcon      = History;

  readonly view        = signal<'pay' | 'history'>('pay');
  readonly submitting  = signal(false);
  readonly refreshing  = signal(false);
  readonly copiedField = signal<string | null>(null);
  readonly receiptPreview = signal<string | null>(null);

  readonly subStatus = computed(() => this.subService.subscription()?.status ?? 'expired');
  readonly settings  = computed(() => this.subService.systemSettings());
  readonly payments  = computed(() => this.subService.payments());

  readonly paymentForm = this.fb.nonNullable.group({
    amount:        [2000, [Validators.required, Validators.min(1)]],
    paymentMethod: ['EASYPAISA' as 'EASYPAISA' | 'BANK', Validators.required],
    transactionId: ['', [Validators.required, Validators.minLength(3)]],
    senderAccount: [''],
  });

  async ngOnInit(): Promise<void> {
    await this.subService.load();
    const fee = this.subService.subscription()?.monthlyFee ?? 2000;
    this.paymentForm.patchValue({ amount: fee });

    // If subscription is now active, go to dashboard
    if (!this.subService.isDown()) {
      void this.router.navigate(['/dashboard']);
    }
  }

  toggleView(): void {
    this.view.set(this.view() === 'pay' ? 'history' : 'pay');
  }

  setMethod(m: 'EASYPAISA' | 'BANK'): void {
    this.paymentForm.patchValue({ paymentMethod: m });
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
    reader.onload = () => this.receiptPreview.set(reader.result as string);
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
        receiptBase64: this.receiptPreview(),
      });
      this.toast.success('Payment submitted! Please wait for admin verification.');
      this.paymentForm.reset({ amount: val.amount, paymentMethod: 'EASYPAISA', transactionId: '', senderAccount: '' });
      this.receiptPreview.set(null);
      // Reload to show pending status
      await this.subService.load();
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
      if (!this.subService.isDown()) {
        this.toast.success('Subscription verified! Redirecting...');
        void this.router.navigate(['/dashboard']);
      } else {
        this.toast.info('Still pending verification.');
      }
    } finally {
      this.refreshing.set(false);
    }
  }

  async signOut(): Promise<void> {
    await this.authService.signOut();
    void this.router.navigate(['/signin']);
  }
}
