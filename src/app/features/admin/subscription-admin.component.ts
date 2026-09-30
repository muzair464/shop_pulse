import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import {
  LucideAngularModule,
  ShieldCheck, XCircle, Clock, CheckCircle2, RefreshCw,
  Building, Smartphone, Eye, DollarSign, Loader2,
  ExternalLink, Copy, Check, Search, Settings2,
} from 'lucide-angular';
import { SubscriptionService, SubscriptionPaymentRecord } from '../../core/subscription.service';
import { ToastService } from '../../core/toast.service';

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

@Component({
  selector: 'app-subscription-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule, DatePipe, DecimalPipe],
  template: `
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
        <button type="button" (click)="refresh()" [disabled]="loading()" class="btn-secondary text-xs">
          <lucide-icon [img]="RefreshCwIcon" size="13" [class.animate-spin]="loading()" />
          Refresh
        </button>
      </div>

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

      <!-- Filter + Search bar -->
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

                    <!-- status pill -->
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

                    <!-- method pill -->
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

                  <!-- Details grid -->
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
    </div>
  `,
})
export class SubscriptionAdminComponent implements OnInit {
  private readonly subService = inject(SubscriptionService);
  private readonly toast      = inject(ToastService);

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
  readonly Settings2Icon    = Settings2;

  readonly filterTabs: { label: string; value: FilterStatus }[] = [
    { label: 'All',      value: 'all'      },
    { label: 'Pending',  value: 'pending'  },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
  ];

  readonly loading       = signal(false);
  readonly allPayments   = signal<SubscriptionPaymentRecord[]>([]);
  readonly activeFilter  = signal<FilterStatus>('pending');
  readonly searchQuery   = signal('');
  readonly actionId      = signal<string | null>(null);
  readonly pendingAction = signal<'approve' | 'reject' | null>(null);
  readonly copiedId      = signal<string | null>(null);

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

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  async ngOnInit(): Promise<void> { await this.refresh(); }

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
      this.toast.success(`Payment approved — ${p.shop_name ?? 'shop'} subscription extended 30 days.`);
      await this.refresh();
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'Failed to approve payment.');
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
      this.toast.error(err instanceof Error ? err.message : 'Failed to reject payment.');
    } finally { this.actionId.set(null); this.pendingAction.set(null); }
  }
}
