import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  ShieldCheck, XCircle, Clock, CheckCircle2, RefreshCw,
  Building, Smartphone, Eye, DollarSign, Loader2,
  ExternalLink, Copy, Check, Search, Lock, KeyRound,
  Settings, Upload, Save, Store, Calendar,
} from 'lucide-angular';
import { SubscriptionService, SubscriptionPaymentRecord } from '../../core/subscription.service';
import { ToastService } from '../../core/toast.service';
import { ApiClient } from '../../core/api.client';

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

interface ShopRecord {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  owner_email: string;
  subscription_status: 'active' | 'expired' | 'pending_verification' | 'trial';
  subscription_expires_at: string | null;
  subscription_monthly_fee: number;
  created_at: string;
}

const SESSION_KEY = 'sp_admin_unlocked';

@Component({
  selector: 'app-subscription-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, DatePipe, DecimalPipe],
  template: `
    <!-- ── Passcode gate ────────────────────────────────────────────── -->
    @if (!unlocked()) {
      <div class="min-h-screen flex items-center justify-center bg-gray-50">
        <div class="w-full max-w-sm">
          <div class="card p-8 flex flex-col items-center gap-6 shadow-lg">
            <div class="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center">
              <lucide-icon [img]="KeyRoundIcon" size="32" class="text-primary-600" />
            </div>
            <div class="text-center">
              <h1 class="text-xl font-bold text-gray-900">Super Admin</h1>
              <p class="text-sm text-gray-500 mt-1">Enter your admin passcode to continue</p>
            </div>

            <div class="w-full space-y-3">
              <input
                #passInput
                type="password"
                placeholder="Enter passcode..."
                (keydown.enter)="verify(passInput.value)"
                class="form-input w-full text-center text-lg tracking-widest"
                [disabled]="verifying()"
              />
              @if (gateError()) {
                <p class="text-xs text-red-600 text-center font-medium">{{ gateError() }}</p>
              }
              <button
                type="button"
                (click)="verify(passInput.value)"
                [disabled]="verifying()"
                class="btn-primary w-full flex items-center justify-center gap-2"
              >
                @if (verifying()) {
                  <lucide-icon [img]="Loader2Icon" size="16" class="animate-spin" />
                } @else {
                  <lucide-icon [img]="LockIcon" size="16" />
                }
                {{ verifying() ? 'Verifying...' : 'Unlock Admin' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- ── Admin Dashboard ──────────────────────────────────────────── -->
    @if (unlocked()) {
      <div class="max-w-5xl mx-auto space-y-6">

        <!-- Header -->
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold text-gray-900 flex items-center gap-2">
              <lucide-icon [img]="ShieldCheckIcon" size="22" class="text-primary-600" />
              Subscription Admin
            </h1>
            <p class="text-sm text-gray-500 mt-0.5">Review and verify shop payment requests</p>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex bg-gray-100 rounded-lg p-1 mr-4">
              <button
                type="button"
                (click)="activeView.set('payments')"
                class="px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
                [class.bg-white]="activeView() === 'payments'"
                [class.shadow-sm]="activeView() === 'payments'"
                [class.text-gray-900]="activeView() === 'payments'"
                [class.text-gray-500]="activeView() !== 'payments'"
              >
                <lucide-icon [img]="ShieldCheckIcon" size="14" />
                Payments
              </button>
              <button
                type="button"
                (click)="loadShops(); activeView.set('shops')"
                class="px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
                [class.bg-white]="activeView() === 'shops'"
                [class.shadow-sm]="activeView() === 'shops'"
                [class.text-gray-900]="activeView() === 'shops'"
                [class.text-gray-500]="activeView() !== 'shops'"
              >
                <lucide-icon [img]="StoreIcon" size="14" />
                Shops
              </button>
              <button
                type="button"
                (click)="activeView.set('settings')"
                class="px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
                [class.bg-white]="activeView() === 'settings'"
                [class.shadow-sm]="activeView() === 'settings'"
                [class.text-gray-900]="activeView() === 'settings'"
                [class.text-gray-500]="activeView() !== 'settings'"
              >
                <lucide-icon [img]="SettingsIcon" size="14" />
                Settings
              </button>
            </div>
            @if (activeView() === 'payments') {
              <button type="button" (click)="refresh()" [disabled]="loading()" class="btn-secondary text-xs">
                <lucide-icon [img]="RefreshCwIcon" size="13" [class.animate-spin]="loading()" />
                Refresh
              </button>
            }
            <button type="button" (click)="lock()" class="btn-secondary text-xs text-red-600 border-red-200 hover:bg-red-50">
              <lucide-icon [img]="LockIcon" size="13" />
              Lock
            </button>
          </div>
        </div>

        @if (activeView() === 'payments') {

        <!-- Stats -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="card p-4 flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <lucide-icon [img]="ClockIcon" size="18" class="text-amber-600" />
            </div>
            <div>
              <p class="text-xs text-gray-500">Pending</p>
              <p class="text-xl font-bold text-gray-900">{{ pendingCount() }}</p>
            </div>
          </div>
          <div class="card p-4 flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
              <lucide-icon [img]="CheckCircle2Icon" size="18" class="text-green-600" />
            </div>
            <div>
              <p class="text-xs text-gray-500">Approved</p>
              <p class="text-xl font-bold text-gray-900">{{ approvedCount() }}</p>
            </div>
          </div>
          <div class="card p-4 flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
              <lucide-icon [img]="XCircleIcon" size="18" class="text-red-600" />
            </div>
            <div>
              <p class="text-xs text-gray-500">Rejected</p>
              <p class="text-xl font-bold text-gray-900">{{ rejectedCount() }}</p>
            </div>
          </div>
          <div class="card p-4 flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
              <lucide-icon [img]="DollarSignIcon" size="18" class="text-primary-600" />
            </div>
            <div>
              <p class="text-xs text-gray-500">Collected</p>
              <p class="text-xl font-bold text-gray-900">Rs.{{ totalCollected() | number:'1.0-0' }}</p>
            </div>
          </div>
        </div>

        <!-- Filter + Search -->
        <div class="card p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div class="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
            @for (tab of filterTabs; track tab.value) {
              <button
                type="button"
                (click)="activeFilter.set(tab.value)"
                class="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                [class.bg-white]="activeFilter() === tab.value"
                [class.shadow-sm]="activeFilter() === tab.value"
                [class.text-gray-900]="activeFilter() === tab.value"
                [class.text-gray-500]="activeFilter() !== tab.value"
              >
                {{ tab.label }}
                @if (tab.value === 'pending' && pendingCount() > 0) {
                  <span class="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                    {{ pendingCount() }}
                  </span>
                }
              </button>
            }
          </div>
          <div class="relative">
            <lucide-icon [img]="SearchIcon" size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Shop name, TRX ID, email..."
              [value]="searchQuery()"
              (input)="onSearch($event)"
              class="form-input pl-8 py-1.5 text-xs w-60"
            />
          </div>
        </div>

        <!-- Payment cards -->
        @if (loading() && filteredPayments().length === 0) {
          <div class="card p-12 flex flex-col items-center justify-center gap-3 text-gray-400">
            <lucide-icon [img]="RefreshCwIcon" size="32" class="animate-spin" />
            <p class="text-sm">Loading...</p>
          </div>
        } @else if (filteredPayments().length === 0) {
          <div class="card p-12 flex flex-col items-center justify-center gap-3 text-gray-400">
            <lucide-icon [img]="CheckCircle2Icon" size="40" class="text-gray-200" />
            <p class="text-sm font-medium">No payment requests found</p>
            <p class="text-xs">
              {{ activeFilter() === 'pending' ? 'All caught up — no pending payments.' : 'No records match this filter.' }}
            </p>
          </div>
        } @else {
          <div class="space-y-3">
            @for (p of filteredPayments(); track p.id) {
              <div
                class="card p-5 border transition-all"
                [class.border-amber-300]="p.status === 'pending'"
                [class.border-green-200]="p.status === 'approved'"
                [class.border-red-200]="p.status === 'rejected'"
              >
                <div class="flex flex-col sm:flex-row sm:items-start gap-4">

                  <!-- Info -->
                  <div class="flex-1 space-y-2 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-bold text-gray-900 truncate">{{ p.shop_name ?? 'Unknown Shop' }}</span>

                      <span
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0"
                        [class.bg-amber-100]="p.status === 'pending'"
                        [class.text-amber-800]="p.status === 'pending'"
                        [class.bg-green-100]="p.status === 'approved'"
                        [class.text-green-800]="p.status === 'approved'"
                        [class.bg-red-100]="p.status === 'rejected'"
                        [class.text-red-800]="p.status === 'rejected'"
                      >
                        @switch (p.status) {
                          @case ('pending')  { <lucide-icon [img]="ClockIcon"        size="10" /> }
                          @case ('approved') { <lucide-icon [img]="CheckCircle2Icon" size="10" /> }
                          @default           { <lucide-icon [img]="XCircleIcon"      size="10" /> }
                        }
                        {{ p.status | titlecase }}
                      </span>

                      <span
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0"
                        [class.bg-emerald-100]="p.payment_method === 'EASYPAISA'"
                        [class.text-emerald-800]="p.payment_method === 'EASYPAISA'"
                        [class.bg-blue-100]="p.payment_method === 'BANK'"
                        [class.text-blue-800]="p.payment_method === 'BANK'"
                      >
                        @if (p.payment_method === 'EASYPAISA') {
                          <lucide-icon [img]="SmartphoneIcon" size="10" />
                        } @else {
                          <lucide-icon [img]="BuildingIcon" size="10" />
                        }
                        {{ p.payment_method }}
                      </span>
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs">
                      <div>
                        <span class="text-gray-400">Amount</span>
                        <p class="font-bold text-gray-900">Rs. {{ p.amount | number }}</p>
                      </div>
                      <div>
                        <span class="text-gray-400">TRX ID</span>
                        <div class="flex items-center gap-1">
                          <p class="font-mono font-semibold text-gray-900">{{ p.transaction_id }}</p>
                          <button type="button" (click)="copy(p.transaction_id)" class="text-gray-300 hover:text-gray-600 transition-colors">
                            <lucide-icon [img]="copiedId() === p.transaction_id ? CheckIcon : CopyIcon" size="11" />
                          </button>
                        </div>
                      </div>
                      @if (p.sender_account) {
                        <div>
                          <span class="text-gray-400">Sender</span>
                          <p class="font-semibold text-gray-900">{{ p.sender_account }}</p>
                        </div>
                      }
                      @if (p.owner_email) {
                        <div>
                          <span class="text-gray-400">Owner</span>
                          <p class="font-semibold text-gray-900 truncate">{{ p.owner_email }}</p>
                        </div>
                      }
                      <div>
                        <span class="text-gray-400">Submitted</span>
                        <p class="font-semibold text-gray-900">{{ p.created_at | date:'dd MMM, h:mm a' }}</p>
                      </div>
                      @if (p.verified_at) {
                        <div>
                          <span class="text-gray-400">Verified</span>
                          <p class="font-semibold text-gray-900">{{ p.verified_at | date:'dd MMM, h:mm a' }}</p>
                        </div>
                      }
                    </div>

                    @if (p.notes) {
                      <p class="text-xs italic text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5">
                        <span class="not-italic font-semibold text-gray-700">Note: </span>{{ p.notes }}
                      </p>
                    }
                    @if (p.admin_notes) {
                      <p class="text-xs italic text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
                        <span class="not-italic font-semibold text-blue-700">Admin: </span>{{ p.admin_notes }}
                      </p>
                    }
                  </div>

                  <!-- Actions -->
                  <div class="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
                    @if (p.receiptDataUri) {
                      <a [href]="p.receiptDataUri" target="_blank" rel="noopener"
                         class="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                        <lucide-icon [img]="EyeIcon" size="12" />
                        View Receipt
                        <lucide-icon [img]="ExternalLinkIcon" size="11" />
                      </a>
                    }

                    @if (p.status === 'pending') {
                      <button
                        type="button"
                        (click)="approvePayment(p)"
                        [disabled]="actionId() === p.id"
                        class="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 bg-green-600 hover:bg-green-700 border-green-600 hover:border-green-700"
                      >
                        @if (actionId() === p.id && pendingAction() === 'approve') {
                          <lucide-icon [img]="Loader2Icon" size="12" class="animate-spin" />
                        } @else {
                          <lucide-icon [img]="ShieldCheckIcon" size="12" />
                        }
                        Approve
                      </button>
                      <button
                        type="button"
                        (click)="rejectPayment(p)"
                        [disabled]="actionId() === p.id"
                        class="btn-danger text-xs py-1.5 px-3 flex items-center gap-1.5"
                      >
                        @if (actionId() === p.id && pendingAction() === 'reject') {
                          <lucide-icon [img]="Loader2Icon" size="12" class="animate-spin" />
                        } @else {
                          <lucide-icon [img]="XCircleIcon" size="12" />
                        }
                        Reject
                      </button>
                    }
                  </div>

                </div>
              </div>
            }
          </div>
        }
        }

        @if (activeView() === 'shops') {
          <div class="card p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
                <lucide-icon [img]="StoreIcon" size="20" class="text-primary-600" />
                All Shops
              </h2>
              <button type="button" (click)="loadShops()" [disabled]="shopsLoading()" class="btn-secondary text-xs">
                <lucide-icon [img]="RefreshCwIcon" size="13" [class.animate-spin]="shopsLoading()" />
                Refresh
              </button>
            </div>

            @if (shopsLoading()) {
              <div class="flex items-center justify-center py-12 text-gray-400">
                <lucide-icon [img]="RefreshCwIcon" size="28" class="animate-spin" />
              </div>
            } @else if (allShops().length === 0) {
              <p class="text-center text-gray-400 py-12">No shops registered yet.</p>
            } @else {
              <div class="overflow-x-auto">
                <table class="w-full text-xs">
                  <thead>
                    <tr class="border-b border-gray-200">
                      <th class="text-left py-2 px-3 text-gray-500 font-semibold">Shop</th>
                      <th class="text-left py-2 px-3 text-gray-500 font-semibold">Contact</th>
                      <th class="text-left py-2 px-3 text-gray-500 font-semibold">ID</th>
                      <th class="text-left py-2 px-3 text-gray-500 font-semibold">Status</th>
                      <th class="text-left py-2 px-3 text-gray-500 font-semibold">Expires</th>
                      <th class="text-left py-2 px-3 text-gray-500 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (s of allShops(); track s.id) {
                      <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td class="py-3 px-3">
                          <p class="font-semibold text-gray-900">{{ s.name }}</p>
                          <p class="text-gray-400">{{ s.address || '—' }}</p>
                        </td>
                        <td class="py-3 px-3">
                          <p class="text-gray-700">{{ s.owner_email }}</p>
                          <p class="text-gray-400">{{ s.phone || '—' }}</p>
                        </td>
                        <td class="py-3 px-3">
                          <span class="font-mono text-[10px] text-gray-400 select-all">{{ s.id }}</span>
                        </td>
                        <td class="py-3 px-3">
                          <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                            [class.bg-green-100]="s.subscription_status === 'active'"
                            [class.text-green-800]="s.subscription_status === 'active'"
                            [class.bg-amber-100]="s.subscription_status === 'pending_verification'"
                            [class.text-amber-800]="s.subscription_status === 'pending_verification'"
                            [class.bg-red-100]="s.subscription_status === 'expired'"
                            [class.text-red-800]="s.subscription_status === 'expired'"
                            [class.bg-blue-100]="s.subscription_status === 'trial'"
                            [class.text-blue-800]="s.subscription_status === 'trial'">
                            {{ s.subscription_status | titlecase }}
                          </span>
                        </td>
                        <td class="py-3 px-3 text-gray-500">
                          {{ s.subscription_expires_at ? (s.subscription_expires_at | date:'dd MMM yyyy') : '—' }}
                        </td>
                        <td class="py-3 px-3">
                          <select
                            class="form-input py-1 text-xs"
                            [value]="s.subscription_status"
                            (change)="changeShopStatus(s.id, $any($event.target).value)">
                            <option value="active">Active</option>
                            <option value="expired">Expired</option>
                            <option value="pending_verification">Pending</option>
                            <option value="trial">Trial</option>
                          </select>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }

        @if (activeView() === 'settings') {
          <div class="card p-6">
            <h2 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <lucide-icon [img]="SettingsIcon" size="20" class="text-primary-600" />
              System Payment Accounts
            </h2>
            <form [formGroup]="adminSettingsForm" (ngSubmit)="saveAdminSubSettings()" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Monthly Fee (Rs.)</label>
                  <input type="number" formControlName="monthlyFee" class="form-input w-full" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input type="text" formControlName="bankName" class="form-input w-full" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Bank Account Title</label>
                  <input type="text" formControlName="accountTitle" class="form-input w-full" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Bank Account Number</label>
                  <input type="text" formControlName="accountNumber" class="form-input w-full" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
                  <input type="text" formControlName="iban" class="form-input w-full" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Easypaisa Title</label>
                  <input type="text" formControlName="easypaisaTitle" class="form-input w-full" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Easypaisa Number</label>
                  <input type="text" formControlName="easypaisaNumber" class="form-input w-full" />
                </div>
              </div>

              <!-- Admin QR Upload -->
              <div class="mt-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">System Payment QR Code</label>
                <div class="flex items-center gap-4">
                  <label class="btn-secondary cursor-pointer py-2 px-4">
                    <lucide-icon [img]="UploadIcon" size="16" />
                    Upload QR Code
                    <input type="file" accept="image/*" class="sr-only" (change)="onAdminQrFileChange($event)" />
                  </label>
                  @if (adminQrPreview()) {
                    <span class="text-sm text-green-600 font-medium flex items-center gap-1">
                      <lucide-icon [img]="CheckCircle2Icon" size="16" />
                      QR Image selected
                    </span>
                  }
                </div>
              </div>

              <div class="flex justify-end pt-4 border-t border-gray-100">
                <button type="submit" class="btn-primary flex items-center gap-2" [disabled]="adminSettingsSaving()">
                  @if (adminSettingsSaving()) {
                    <lucide-icon [img]="Loader2Icon" size="16" class="animate-spin" />
                  } @else {
                    <lucide-icon [img]="SaveIcon" size="16" />
                  }
                  Save System Accounts
                </button>
              </div>
            </form>
          </div>
        }

      </div>
    }
  `,
})
export class SubscriptionAdminComponent implements OnInit {
  private readonly subService = inject(SubscriptionService);
  private readonly toast      = inject(ToastService);
  private readonly api        = inject(ApiClient);

  readonly ShieldCheckIcon  = ShieldCheck;
  readonly XCircleIcon      = XCircle;
  readonly ClockIcon        = Clock;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly RefreshCwIcon    = RefreshCw;
  readonly BuildingIcon     = Building;
  readonly SmartphoneIcon   = Smartphone;
  readonly EyeIcon          = Eye;
  readonly DollarSignIcon   = DollarSign;
  readonly Loader2Icon      = Loader2;
  readonly ExternalLinkIcon = ExternalLink;
  readonly CopyIcon         = Copy;
  readonly CheckIcon        = Check;
  readonly SearchIcon       = Search;
  readonly LockIcon         = Lock;
  readonly KeyRoundIcon     = KeyRound;
  readonly SettingsIcon     = Settings;
  readonly UploadIcon       = Upload;
  readonly SaveIcon         = Save;
  readonly StoreIcon        = Store;
  readonly CalendarIcon     = Calendar;

  private readonly fb       = inject(FormBuilder);

  readonly activeView = signal<'payments' | 'shops' | 'settings'>('payments');

  readonly filterTabs: { label: string; value: FilterStatus }[] = [
    { label: 'All',      value: 'all'      },
    { label: 'Pending',  value: 'pending'  },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
  ];

  // ── Passcode gate ─────────────────────────────────────────────────────────
  readonly unlocked    = signal(!!sessionStorage.getItem('sp_admin_passcode'));
  readonly verifying   = signal(false);
  readonly gateError   = signal<string | null>(null);

  // ── Admin state ───────────────────────────────────────────────────────────
  readonly loading       = signal(false);
  readonly allPayments   = signal<SubscriptionPaymentRecord[]>([]);
  readonly activeFilter  = signal<FilterStatus>('pending');
  readonly searchQuery   = signal('');
  readonly actionId      = signal<string | null>(null);
  readonly pendingAction = signal<'approve' | 'reject' | null>(null);
  readonly copiedId      = signal<string | null>(null);

  // ── Shops state ───────────────────────────────────────────────────────────
  readonly allShops     = signal<ShopRecord[]>([]);
  readonly shopsLoading = signal(false);

  readonly pendingCount   = computed(() => this.allPayments().filter(p => p.status === 'pending').length);
  readonly approvedCount  = computed(() => this.allPayments().filter(p => p.status === 'approved').length);
  readonly rejectedCount  = computed(() => this.allPayments().filter(p => p.status === 'rejected').length);
  readonly totalCollected = computed(() =>
    this.allPayments().filter(p => p.status === 'approved').reduce((s, p) => s + Number(p.amount), 0),
  );

  readonly filteredPayments = computed(() => {
    let list = this.allPayments();
    if (this.activeFilter() !== 'all') list = list.filter(p => p.status === this.activeFilter());
    const q = this.searchQuery().toLowerCase().trim();
    if (q) list = list.filter(p =>
      p.shop_name?.toLowerCase().includes(q) ||
      p.transaction_id.toLowerCase().includes(q) ||
      p.owner_email?.toLowerCase().includes(q) ||
      p.sender_account?.toLowerCase().includes(q),
    );
    return list;
  });

  // ── Settings state ────────────────────────────────────────────────────────
  readonly adminSettingsSaving = signal(false);
  readonly adminQrPreview      = signal<string | null>(null);

  readonly adminSettingsForm = this.fb.nonNullable.group({
    monthlyFee:      [2000, [Validators.required, Validators.min(1)]],
    bankName:        [''],
    accountTitle:    [''],
    accountNumber:   [''],
    iban:            [''],
    easypaisaTitle:  [''],
    easypaisaNumber: [''],
    instructions:    ['Transfer the monthly fee to Easypaisa or Bank Account, then submit TRX ID.'],
  });

  async ngOnInit(): Promise<void> {
    if (this.unlocked()) {
      await this.refresh();
      await this.loadSettings();
    }
  }

  async verify(passcode: string): Promise<void> {
    if (!passcode.trim()) { this.gateError.set('Please enter the passcode.'); return; }
    this.verifying.set(true);
    this.gateError.set(null);
    try {
      await this.api.post<{ ok: boolean }>('/api/v1/subscription/admin/auth', { passcode });
      sessionStorage.setItem('sp_admin_passcode', passcode);
      this.unlocked.set(true);
      await this.refresh();
      await this.loadSettings();
    } catch (err) {
      this.gateError.set(err instanceof Error ? err.message : 'Incorrect passcode.');
    } finally {
      this.verifying.set(false);
    }
  }

  lock(): void {
    sessionStorage.removeItem('sp_admin_passcode');
    this.unlocked.set(false);
    this.allPayments.set([]);
    this.activeView.set('payments');
  }

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.allPayments.set(await this.subService.loadAdminPayments());
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'Failed to load payments.');
    } finally {
      this.loading.set(false);
    }
  }

  copy(text: string): void {
    navigator.clipboard?.writeText(text);
    this.copiedId.set(text);
    setTimeout(() => this.copiedId.set(null), 2000);
  }

  async approvePayment(p: SubscriptionPaymentRecord): Promise<void> {
    const notes = prompt('Approval note for shop owner (optional):') ?? '';
    this.actionId.set(p.id); this.pendingAction.set('approve');
    try {
      await this.subService.verifyPayment(p.id, 'approve', notes || undefined);
      this.toast.success(`Approved — ${p.shop_name ?? 'shop'} subscription extended 30 days.`);
      await this.refresh();
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'Failed to approve.');
    } finally { this.actionId.set(null); this.pendingAction.set(null); }
  }

  async rejectPayment(p: SubscriptionPaymentRecord): Promise<void> {
    const notes = prompt('Reason for rejection (shown to shop owner):');
    if (notes === null) return;
    this.actionId.set(p.id); this.pendingAction.set('reject');
    try {
      await this.subService.verifyPayment(p.id, 'reject', notes || 'Payment could not be verified.');
      this.toast.success('Payment rejected.');
      await this.refresh();
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'Failed to reject.');
    } finally { this.actionId.set(null); this.pendingAction.set(null); }
  }

  // ── Settings methods ──────────────────────────────────────────────────────
  async loadSettings(): Promise<void> {
    try {
      const s = await this.subService.loadAdminSettings();
      if (s) {
        this.adminSettingsForm.patchValue({
          monthlyFee:      s.monthly_fee ?? 2000,
          bankName:        s.bank_name ?? '',
          accountTitle:    s.account_title ?? '',
          accountNumber:   s.account_number ?? '',
          iban:            s.iban ?? '',
          easypaisaTitle:  s.easypaisa_title ?? '',
          easypaisaNumber: s.easypaisa_number ?? '',
          instructions:    s.instructions ?? '',
        });
        this.adminQrPreview.set(s.paymentQrDataUri);
      }
    } catch (err) {
      this.toast.error('Failed to load system settings.');
    }
  }

  onAdminQrFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUri = e.target?.result as string;
      this.adminQrPreview.set(dataUri);
    };
    reader.readAsDataURL(file);
  }

  async saveAdminSubSettings(): Promise<void> {
    if (this.adminSettingsForm.invalid) return;
    this.adminSettingsSaving.set(true);
    try {
      const val = this.adminSettingsForm.getRawValue();
      await this.subService.updateSystemSettings({
        monthly_fee:      Number(val.monthlyFee),
        bank_name:        val.bankName,
        account_title:    val.accountTitle,
        account_number:   val.accountNumber,
        iban:             val.iban,
        easypaisa_title:  val.easypaisaTitle,
        easypaisa_number: val.easypaisaNumber,
        instructions:     val.instructions,
        paymentQrBase64:  this.adminQrPreview(),
      });
      this.toast.success('System payment accounts updated successfully.');
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'Failed to update system accounts.');
    } finally {
      this.adminSettingsSaving.set(false);
    }
  }

  // ── Shops management ─────────────────────────────────────────────────────────────
  async loadShops(): Promise<void> {
    this.shopsLoading.set(true);
    try {
      const passcode = sessionStorage.getItem('sp_admin_passcode') ?? '';
      const res = await this.api.get<{ shops: ShopRecord[] }>(
        '/api/v1/subscription/admin/shops',
        { headers: { 'X-Admin-Passcode': passcode } }
      );
      this.allShops.set(res.shops);
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'Failed to load shops.');
    } finally {
      this.shopsLoading.set(false);
    }
  }

  async changeShopStatus(
    shopId: string,
    status: 'active' | 'expired' | 'pending_verification' | 'trial'
  ): Promise<void> {
    try {
      const passcode = sessionStorage.getItem('sp_admin_passcode') ?? '';
      // active/trial → set 30-day expiry so shop is unblocked immediately
      // expired → set expiry to now so shop is locked immediately
      // pending_verification → leave expiry unchanged
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const expiresAt =
        status === 'active' || status === 'trial' ? thirtyDaysFromNow :
        status === 'expired'                      ? new Date().toISOString() :
        undefined;

      await this.api.patch(
        '/api/v1/subscription/admin/shops',
        { shopId, subscriptionStatus: status, subscriptionExpiresAt: expiresAt },
        { headers: { 'X-Admin-Passcode': passcode } }
      );
      this.toast.success(`Shop marked as "${status}". Database updated.`);
      await this.loadShops();
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'Failed to update shop.');
    }
  }
}

