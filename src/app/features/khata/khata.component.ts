import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  BookOpen, Plus, Search, Eye, FileText, X, Loader2,
  Users, AlertTriangle, CheckCircle, RefreshCw,
  ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft,
  Trash2, CircleDollarSign, UserPlus,
} from 'lucide-angular';
import { ApiClient, ApiError } from '../../core/api.client';
import { ToastService } from '../../core/toast.service';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Customer {
  id: string; shop_id: string; name: string;
  phone: string | null; cnic: string | null; notes: string | null;
  balance: number; created_at: string; updated_at: string;
  last_tx_at: string | null; last_repayment_at: string | null; tx_count: number;
}
interface KhataTransaction {
  id: string; customer_id: string; order_id: string | null;
  tx_type: 'CREDIT' | 'REPAYMENT'; amount: number;
  notes: string | null; created_at: string; voided_at: string | null;
  order_number?: string | null;
}
interface KpiData {
  total_customers: number; overdue_count: number;
  total_outstanding: number; total_advance: number;
}
type StatusFilter = 'all' | 'overdue' | 'settled';
type ModalMode    = 'record' | 'add_customer';

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}
function avatarColor(name: string): string {
  const palette = [
    'bg-blue-500', 'bg-violet-500', 'bg-green-500', 'bg-amber-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}
function fmtPkr(n: number): string {
  return 'PKR ' + Number(n).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

@Component({
  selector: 'app-khata',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, ReactiveFormsModule, LucideAngularModule],
  template: `
<div class="space-y-5 pb-10">

  <!-- ── Page header ───────────────────────────────────────────── -->
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-xl font-bold text-gray-900 flex items-center gap-2">
        <lucide-icon [img]="BookOpenIcon" size="20" class="text-primary-600" aria-hidden="true"/>
        Khata
      </h1>
      <p class="text-sm text-gray-500 mt-0.5">Customer credit ledger and repayment history</p>
    </div>
    <div class="flex items-center gap-2">
      <button type="button" (click)="load()" [disabled]="loading()"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200
               text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        [attr.aria-busy]="loading()">
        <lucide-icon [img]="RefreshCwIcon" size="13"
          [class.animate-spin]="loading()" aria-hidden="true"/>
        Refresh
      </button>
      <button type="button" (click)="openAddCustomer()" class="btn-primary text-sm py-1.5 px-3">
        <lucide-icon [img]="UserPlusIcon" size="14" aria-hidden="true"/>
        New Customer
      </button>
    </div>
  </div>

  <!-- ── KPI cards ─────────────────────────────────────────────── -->
  @if (kpi()) {
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="card p-5 hover:shadow-raised transition-shadow duration-200 ease-sp">
        <div class="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center mb-3">
          <lucide-icon [img]="UsersIcon" size="16" class="text-primary-500" aria-hidden="true"/>
        </div>
        <p class="text-2xl font-extrabold text-ink tabular-nums">{{ kpi()!.total_customers }}</p>
        <p class="text-2xs font-semibold text-gray-500 uppercase tracking-wide mt-0.5">Active Accounts</p>
      </div>
      <div class="card p-5 hover:shadow-raised transition-shadow duration-200 ease-sp">
        <div class="w-9 h-9 rounded-xl bg-danger-50 flex items-center justify-center mb-3">
          <lucide-icon [img]="AlertTriangleIcon" size="16" class="text-danger-600" aria-hidden="true"/>
        </div>
        <p class="text-2xl font-extrabold text-danger-600 tabular-nums font-mono">
          {{ fmtPkr(kpi()!.total_outstanding) }}
        </p>
        <p class="text-2xs font-semibold text-gray-500 uppercase tracking-wide mt-0.5">Total Outstanding</p>
        <p class="text-xs text-gray-400 mt-0.5">{{ kpi()!.overdue_count }} overdue</p>
      </div>
      <div class="card p-5 hover:shadow-raised transition-shadow duration-200 ease-sp">
        <div class="w-9 h-9 rounded-xl bg-success-50 flex items-center justify-center mb-3">
          <lucide-icon [img]="CheckCircleIcon" size="16" class="text-success-600" aria-hidden="true"/>
        </div>
        <p class="text-2xl font-extrabold text-ink tabular-nums">
          {{ kpi()!.total_customers - kpi()!.overdue_count }}
        </p>
        <p class="text-2xs font-semibold text-gray-500 uppercase tracking-wide mt-0.5">Settled Accounts</p>
      </div>
      <div class="card p-5 hover:shadow-raised transition-shadow duration-200 ease-sp">
        <div class="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center mb-3">
          <lucide-icon [img]="CircleDollarSignIcon" size="16" class="text-violet-600" aria-hidden="true"/>
        </div>
        <p class="text-2xl font-extrabold text-ink tabular-nums font-mono">
          {{ kpi()!.overdue_count > 0 ? fmtPkr(kpi()!.total_outstanding / kpi()!.overdue_count) : 'PKR 0' }}
        </p>
        <p class="text-2xs font-semibold text-gray-500 uppercase tracking-wide mt-0.5">Avg Outstanding</p>
      </div>
    </div>
  }

  <!-- ── Customer table ────────────────────────────────────────── -->
  <div class="card overflow-hidden">

    <!-- Toolbar: search + status filter -->
    <div class="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
      <!-- Search input -->
      <div class="relative flex-1 min-w-[200px]">
        <lucide-icon [img]="SearchIcon" size="14"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          aria-hidden="true"/>
        <input type="search"
          [(ngModel)]="searchQuery"
          (ngModelChange)="onSearch()"
          placeholder="Search by name, phone, or CNIC..."
          class="form-input pl-8 text-sm py-1.5"
          aria-label="Search customers"/>
      </div>
      <!-- Status filter tabs -->
      <div class="flex gap-1" role="group" aria-label="Filter by status">
        @for (opt of statusOptions; track opt.value) {
          <button type="button" (click)="setStatus(opt.value)"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors"
            [class]="statusFilter() === opt.value
              ? 'bg-primary-600 text-white border-primary-600 hover:bg-primary-700'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-800'">
            {{ opt.label }}
          </button>
        }
      </div>
    </div>

    <!-- Desktop table -->
    <div class="hidden md:block overflow-x-auto">
      <table class="w-full text-sm" aria-label="Customer Khata Records">
        <thead class="bg-gray-50 border-b border-gray-100">
          <tr>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-[38%]">Customer</th>
            <th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance</th>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Last Activity</th>
            <th class="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          @if (loading() && !customers().length) {
            @for (_ of [1,2,3,4,5]; track $index) {
              <tr class="animate-pulse">
                <td class="px-4 py-3.5">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full bg-gray-100 shrink-0"></div>
                    <div class="space-y-1.5 flex-1">
                      <div class="h-3.5 bg-gray-100 rounded w-32"></div>
                      <div class="h-3 bg-gray-100 rounded w-24"></div>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3.5 text-right"><div class="h-4 bg-gray-100 rounded w-20 ml-auto"></div></td>
                <td class="px-4 py-3.5 hidden lg:table-cell"><div class="h-4 bg-gray-100 rounded w-28"></div></td>
                <td class="px-4 py-3.5 text-center"><div class="h-5 bg-gray-100 rounded-full w-16 mx-auto"></div></td>
                <td class="px-4 py-3.5"><div class="h-4 bg-gray-100 rounded w-16 ml-auto"></div></td>
              </tr>
            }
          } @else if (!customers().length) {
            <tr>
              <td colspan="5" class="px-4 py-14 text-center">
                <lucide-icon [img]="UsersIcon" size="32" class="mx-auto mb-2 text-gray-200" aria-hidden="true"/>
                <p class="text-sm text-gray-400">
                  @if (searchQuery.trim()) {
                    No customers match "{{ searchQuery }}"
                  } @else {
                    No customers yet. Add one to get started.
                  }
                </p>
              </td>
            </tr>
          } @else {
            @for (c of customers(); track c.id) {
              <tr class="hover:bg-gray-50/70 transition-colors cursor-pointer" (click)="openDetail(c)">
                <td class="px-4 py-3.5">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full flex items-center justify-center
                                text-white text-xs font-bold shrink-0"
                         [class]="avatarColor(c.name)">{{ initials(c.name) }}</div>
                    <div class="min-w-0">
                      <p class="font-semibold text-gray-800 truncate">{{ c.name }}</p>
                      @if (c.phone) {
                        <p class="text-xs text-gray-400 truncate">{{ c.phone }}</p>
                      }
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3.5 text-right">
                  <span class="font-bold tabular-nums text-sm font-mono"
                    [class.text-ledger-debit]="c.balance > 0"
                    [class.text-gray-600]="c.balance <= 0">
                    {{ fmtPkr(c.balance) }}
                  </span>
                </td>
                <td class="px-4 py-3.5 text-xs text-gray-400 hidden lg:table-cell">
                  {{ c.last_tx_at ? (c.last_tx_at | date:'dd MMM yyyy') : '—' }}
                </td>
                <td class="px-4 py-3.5 text-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide"
                    [class]="c.balance > 0
                      ? 'bg-danger-50 text-danger-700'
                      : 'bg-success-50 text-success-700'">
                    {{ c.balance > 0 ? 'Overdue' : 'Settled' }}
                  </span>
                </td>
                <td class="px-4 py-3.5">
                  <div class="flex items-center justify-end gap-1">
                    <button type="button" (click)="$event.stopPropagation(); openDetail(c)"
                      class="p-1.5 rounded-lg text-gray-400 hover:text-primary-600
                             hover:bg-primary-50 transition-colors" aria-label="View">
                      <lucide-icon [img]="EyeIcon" size="14" aria-hidden="true"/>
                    </button>
                    <button type="button" (click)="$event.stopPropagation(); openRecord(c)"
                      class="p-1.5 rounded-lg text-gray-400 hover:text-green-600
                             hover:bg-green-50 transition-colors" aria-label="Record transaction">
                      <lucide-icon [img]="FileTextIcon" size="14" aria-hidden="true"/>
                    </button>
                  </div>
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>

    <!-- Mobile cards -->
    <div class="md:hidden divide-y divide-gray-100">
      @for (c of customers(); track c.id) {
        <div class="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 cursor-pointer"
             (click)="openDetail(c)">
          <div class="w-10 h-10 rounded-full flex items-center justify-center
                      text-white text-sm font-bold shrink-0" [class]="avatarColor(c.name)">
            {{ initials(c.name) }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-gray-800 text-sm truncate">{{ c.name }}</p>
            @if (c.phone) { <p class="text-xs text-gray-400 truncate">{{ c.phone }}</p> }
          </div>
          <div class="text-right shrink-0">
            <p class="text-sm font-bold tabular-nums"
              [class.text-red-600]="c.balance > 0" [class.text-gray-700]="c.balance <= 0">
              {{ fmtPkr(c.balance) }}
            </p>
            <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              [class]="c.balance > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'">
              {{ c.balance > 0 ? 'Overdue' : 'Settled' }}
            </span>
          </div>
        </div>
      }
    </div>

    <!-- Pagination -->
    @if (totalPages() > 1) {
      <div class="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
        <p class="text-xs text-gray-400">
          Showing {{ (page()-1)*20+1 }}-{{ Math.min(page()*20, total()) }} of {{ total() }}
        </p>
        <div class="flex items-center gap-1">
          <button type="button" (click)="setPage(page()-1)" [disabled]="page()===1"
            class="p-1.5 rounded-lg border border-gray-200 text-gray-500
                   hover:bg-gray-50 disabled:opacity-40 transition-colors" aria-label="Previous">
            <lucide-icon [img]="ChevronLeftIcon" size="14" aria-hidden="true"/>
          </button>
          <span class="px-3 py-1 text-xs text-gray-600 tabular-nums">{{ page() }} / {{ totalPages() }}</span>
          <button type="button" (click)="setPage(page()+1)" [disabled]="page()===totalPages()"
            class="p-1.5 rounded-lg border border-gray-200 text-gray-500
                   hover:bg-gray-50 disabled:opacity-40 transition-colors" aria-label="Next">
            <lucide-icon [img]="ChevronRightIcon" size="14" aria-hidden="true"/>
          </button>
        </div>
      </div>
    }
  </div>
</div>

<!-- ── Customer Detail Drawer ─────────────────────────────────────────────── -->
@if (detailCustomer()) {
  <div class="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
    <div class="absolute inset-0 bg-black/40" (click)="closeDetail()"></div>
    <div class="relative ml-auto w-full max-w-lg h-full bg-white shadow-2xl flex flex-col overflow-hidden">

      <!-- Header -->
      <div class="px-5 py-4 border-b border-gray-100 flex items-center gap-3 shrink-0">
        <div class="w-11 h-11 rounded-full flex items-center justify-center
                    text-white font-bold shrink-0 text-sm"
             [class]="avatarColor(detailCustomer()!.name)">
          {{ initials(detailCustomer()!.name) }}
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="font-bold text-gray-900 truncate">{{ detailCustomer()!.name }}</h2>
          @if (detailCustomer()!.phone) {
            <p class="text-xs text-gray-400">{{ detailCustomer()!.phone }}</p>
          }
        </div>
        <div class="text-right shrink-0">
          <p class="text-lg font-bold tabular-nums"
            [class.text-red-600]="detailCustomer()!.balance > 0"
            [class.text-green-700]="detailCustomer()!.balance <= 0">
            {{ fmtPkr(detailCustomer()!.balance) }}
          </p>
          <p class="text-[10px] text-gray-400">outstanding</p>
        </div>
        <button type="button" (click)="closeDetail()"
          class="ml-1 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          aria-label="Close">
          <lucide-icon [img]="XIcon" size="16" aria-hidden="true"/>
        </button>
      </div>

      <!-- Transaction search in drawer -->
      <div class="px-5 py-3 border-b border-gray-100 shrink-0 space-y-2">
        <div class="relative">
          <lucide-icon [img]="SearchIcon" size="13"
            class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            aria-hidden="true"/>
          <input type="search"
            [(ngModel)]="txSearchQuery"
            placeholder="Search transactions..."
            class="form-input pl-8 text-xs py-1.5"
            aria-label="Search transactions"/>
        </div>
        <button type="button" (click)="openRecord(detailCustomer()!)"
          class="btn-primary w-full justify-center text-xs py-2">
          <lucide-icon [img]="PlusIcon" size="13" aria-hidden="true"/>
          Record Transaction
        </button>
      </div>

      <!-- Transaction list — rendered as a traditional ledger page -->
      <div class="flex-1 overflow-y-auto">
        @if (detailLoading()) {
          <div class="py-12 flex justify-center">
            <lucide-icon [img]="Loader2Icon" size="28" class="animate-spin text-gray-200" aria-hidden="true"/>
          </div>
        } @else if (!filteredTransactions().length) {
          <div class="py-14 text-center">
            <lucide-icon [img]="FileTextIcon" size="28" class="mx-auto mb-2 text-gray-200" aria-hidden="true"/>
            <p class="text-sm text-gray-400">
              @if (txSearchQuery.trim()) {
                No transactions match "{{ txSearchQuery }}"
              } @else {
                No transactions yet. Record one above.
              }
            </p>
          </div>
        } @else {
          <!-- Ledger header row — mimics the column header of a paper ledger -->
          <div class="flex items-center px-5 py-2 bg-surface-raised border-b border-ledger-rule
                      text-2xs font-semibold text-gray-400 uppercase tracking-wider">
            <span class="w-8 shrink-0"></span>
            <span class="flex-1">Entry</span>
            <span class="w-28 text-right">Amount</span>
          </div>
          <ul>
            @for (tx of filteredTransactions(); track tx.id) {
              <li class="ledger-row"
                  [class.ledger-row-debit]="tx.tx_type === 'CREDIT' && !tx.voided_at"
                  [class.ledger-row-credit]="tx.tx_type === 'REPAYMENT' && !tx.voided_at"
                  [class.opacity-40]="tx.voided_at">

                <!-- Type icon -->
                <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  [class]="tx.tx_type === 'CREDIT'
                    ? 'bg-ledger-debit-bg border border-ledger-debit/20'
                    : 'bg-ledger-credit-bg border border-ledger-credit/20'">
                  <lucide-icon
                    [img]="tx.tx_type === 'CREDIT' ? ArrowUpRightIcon : ArrowDownLeftIcon"
                    size="13"
                    [class]="tx.tx_type === 'CREDIT' ? 'text-ledger-debit' : 'text-ledger-credit'"
                    aria-hidden="true"/>
                </div>

                <!-- Entry details -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-baseline justify-between gap-2">
                    <!-- Left: label + date -->
                    <div class="min-w-0">
                      <span class="text-xs font-semibold"
                        [class.text-ledger-debit]="tx.tx_type === 'CREDIT'"
                        [class.text-ledger-credit]="tx.tx_type === 'REPAYMENT'">
                        {{ tx.tx_type === 'CREDIT' ? 'Credit given' : 'Repayment received' }}
                      </span>
                      @if (tx.order_number) {
                        <span class="text-2xs text-gray-400 ml-1.5 font-mono">{{ tx.order_number }}</span>
                      }
                      @if (tx.voided_at) {
                        <span class="text-2xs text-gray-400 ml-1">(voided)</span>
                      }
                      @if (tx.notes) {
                        <p class="text-2xs text-gray-400 mt-0.5 italic truncate">{{ tx.notes }}</p>
                      }
                    </div>
                    <!-- Right: amount in ledger-style mono font -->
                    <span class="font-mono text-sm font-bold tabular-nums shrink-0"
                      [class.text-ledger-debit]="tx.tx_type === 'CREDIT'"
                      [class.text-ledger-credit]="tx.tx_type === 'REPAYMENT'">
                      {{ tx.tx_type === 'CREDIT' ? '+' : '−' }}{{ fmtPkr(tx.amount) }}
                    </span>
                  </div>
                  <p class="text-2xs text-gray-400 mt-0.5">
                    {{ tx.created_at | date:'dd MMM yyyy, h:mm a' }}
                  </p>
                </div>

                @if (!tx.voided_at) {
                  <button type="button" (click)="voidTx(tx)"
                    class="p-1 text-gray-300 hover:text-danger-500 transition-colors duration-150 ease-sp shrink-0"
                    aria-label="Void transaction">
                    <lucide-icon [img]="Trash2Icon" size="12" aria-hidden="true"/>
                  </button>
                }
              </li>
            }
          </ul>
        }
      </div>
    </div>
  </div>
}

<!-- ── Transaction / Add Customer Modal ──────────────────────────────────── -->
@if (modalOpen()) {
  <div class="fixed inset-0 z-[60] flex items-center justify-center p-4"
       role="dialog" aria-modal="true">
    <div class="absolute inset-0 bg-black/50" (click)="closeModal()"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

      <!-- Header -->
      <div class="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
        <div>
          <h3 class="text-base font-bold text-gray-900">
            {{ modalMode() === 'add_customer' ? 'Add New Customer' : 'Record Transaction' }}
          </h3>
          <p class="text-xs text-gray-400 mt-0.5">
            {{ modalMode() === 'add_customer'
               ? 'Create a customer profile for Khata tracking'
               : 'Update customer ledger balance instantly' }}
          </p>
        </div>
        <button type="button" (click)="closeModal()"
          class="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors -mr-1"
          aria-label="Close">
          <lucide-icon [img]="XIcon" size="16" aria-hidden="true"/>
        </button>
      </div>

      <!-- ADD CUSTOMER -->
      @if (modalMode() === 'add_customer') {
        <form [formGroup]="addForm" (ngSubmit)="submitAddCustomer()" class="px-6 py-5 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">
              Full Name <span class="text-red-500">*</span>
            </label>
            <input type="text" formControlName="name" placeholder="Muhammad Ahmed" class="form-input"
              aria-required="true"/>
            @if (addForm.controls['name'].invalid && addForm.controls['name'].touched) {
              <p class="text-xs text-red-500 mt-1">Name is required.</p>
            }
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5">Phone</label>
              <input type="tel" formControlName="phone" placeholder="+92 300 0000000" class="form-input"/>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5">CNIC</label>
              <input type="text" formControlName="cnic" placeholder="35201-XXXXXXX-X" class="form-input"/>
            </div>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
            <textarea formControlName="notes" rows="2" placeholder="Any additional notes..."
              class="form-input resize-none"></textarea>
          </div>
          @if (modalError()) {
            <p class="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{{ modalError() }}</p>
          }
          <div class="flex gap-3 pt-1">
            <button type="button" (click)="closeModal()" class="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button type="submit" class="btn-primary flex-1 justify-center" [disabled]="modalLoading()">
              @if (modalLoading()) {
                <lucide-icon [img]="Loader2Icon" size="15" class="animate-spin" aria-hidden="true"/>
              }
              Add Customer
            </button>
          </div>
        </form>
      }

      <!-- RECORD TRANSACTION -->
      @if (modalMode() === 'record') {
        <div class="px-6 py-5 space-y-4">
          <!-- Tx type -->
          <div>
            <p class="text-xs font-semibold text-gray-600 mb-2">Transaction Type</p>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" (click)="txType.set('CREDIT')"
                class="flex items-center justify-center gap-2 py-3 rounded-xl border-2
                       text-sm font-semibold transition-all duration-150 ease-sp"
                [class]="txType() === 'CREDIT'
                  ? 'border-ledger-debit bg-ledger-debit-bg text-ledger-debit'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'">
                <lucide-icon [img]="ArrowUpRightIcon" size="15" aria-hidden="true"/>
                Credit Given
              </button>
              <button type="button" (click)="txType.set('REPAYMENT')"
                class="flex items-center justify-center gap-2 py-3 rounded-xl border-2
                       text-sm font-semibold transition-all duration-150 ease-sp"
                [class]="txType() === 'REPAYMENT'
                  ? 'border-ledger-credit bg-ledger-credit-bg text-ledger-credit'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'">
                <lucide-icon [img]="ArrowDownLeftIcon" size="15" aria-hidden="true"/>
                Repayment
              </button>
            </div>
          </div>

          <!-- Customer -->
          <div>
            <p class="text-xs font-semibold text-gray-600 mb-1.5">Customer</p>
            @if (modalCustomer()) {
              <div class="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200">
                <div class="w-8 h-8 rounded-full flex items-center justify-center
                            text-white text-xs font-bold shrink-0"
                     [class]="avatarColor(modalCustomer()!.name)">
                  {{ initials(modalCustomer()!.name) }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-800 truncate">{{ modalCustomer()!.name }}</p>
                  @if (modalCustomer()!.phone) {
                    <p class="text-xs text-gray-400">{{ modalCustomer()!.phone }}</p>
                  }
                </div>
                <span class="text-sm font-bold tabular-nums shrink-0"
                  [class.text-red-600]="modalCustomer()!.balance > 0"
                  [class.text-green-600]="modalCustomer()!.balance <= 0">
                  {{ fmtPkr(modalCustomer()!.balance) }}
                </span>
              </div>
            } @else {
              <select [(ngModel)]="selectedCustomerId" class="form-input text-sm"
                aria-label="Select customer">
                <option value="">-- Select customer --</option>
                @for (c of customers(); track c.id) {
                  <option [value]="c.id">{{ c.name }}{{ c.phone ? ' - ' + c.phone : '' }}</option>
                }
              </select>
            }
          </div>

          <!-- Amount -->
          <div>
            <p class="text-xs font-semibold text-gray-600 mb-1.5">Amount (PKR)</p>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold
                           text-gray-400 pointer-events-none">Rs</span>
              <input type="number" [(ngModel)]="txAmount" min="1"
                class="form-input pl-10 text-xl font-bold tabular-nums"
                placeholder="0.00" aria-label="Amount"/>
            </div>
          </div>

          <!-- Notes -->
          <div>
            <p class="text-xs font-semibold text-gray-600 mb-1.5">Notes</p>
            <input type="text" [(ngModel)]="txNotes"
              placeholder="e.g. Partial payment for iPhone 13 Pro"
              class="form-input text-sm"/>
          </div>

          @if (modalError()) {
            <p class="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{{ modalError() }}</p>
          }
          <div class="flex gap-3 pt-1">
            <button type="button" (click)="closeModal()" class="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button type="button" (click)="submitTransaction()"
              class="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2
                     text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50"
              [class]="txType() === 'REPAYMENT' ? 'bg-green-600 hover:bg-green-700' : 'bg-primary-600 hover:bg-primary-700'"
              [disabled]="modalLoading()">
              @if (modalLoading()) {
                <lucide-icon [img]="Loader2Icon" size="15" class="animate-spin" aria-hidden="true"/>
              }
              Confirm Transaction
            </button>
          </div>
        </div>
      }
    </div>
  </div>
}
  `,
})
export class KhataComponent implements OnInit {
  private readonly api   = inject(ApiClient);
  private readonly toast = inject(ToastService);
  private readonly fb    = inject(FormBuilder);

  readonly Math = Math;

  // Icons
  readonly BookOpenIcon         = BookOpen;
  readonly PlusIcon             = Plus;
  readonly SearchIcon           = Search;
  readonly EyeIcon              = Eye;
  readonly FileTextIcon         = FileText;
  readonly XIcon                = X;
  readonly Loader2Icon          = Loader2;
  readonly UsersIcon            = Users;
  readonly AlertTriangleIcon    = AlertTriangle;
  readonly CheckCircleIcon      = CheckCircle;
  readonly RefreshCwIcon        = RefreshCw;
  readonly ChevronLeftIcon      = ChevronLeft;
  readonly ChevronRightIcon     = ChevronRight;
  readonly ArrowUpRightIcon     = ArrowUpRight;
  readonly ArrowDownLeftIcon    = ArrowDownLeft;
  readonly Trash2Icon           = Trash2;
  readonly CircleDollarSignIcon = CircleDollarSign;
  readonly UserPlusIcon         = UserPlus;

  // Helpers
  readonly fmtPkr      = fmtPkr;
  readonly initials    = initials;
  readonly avatarColor = avatarColor;

  // ── List state ─────────────────────────────────────────────────
  readonly customers    = signal<Customer[]>([]);
  readonly kpi          = signal<KpiData | null>(null);
  readonly loading      = signal(false);
  readonly total        = signal(0);
  readonly page         = signal(1);
  readonly statusFilter = signal<StatusFilter>('all');
  searchQuery           = '';
  private searchTimer:  ReturnType<typeof setTimeout> | null = null;

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / 20)));

  readonly statusOptions: { label: string; value: StatusFilter }[] = [
    { label: 'All',     value: 'all' },
    { label: 'Overdue', value: 'overdue' },
    { label: 'Settled', value: 'settled' },
  ];

  // ── Detail drawer ──────────────────────────────────────────────
  readonly detailCustomer     = signal<Customer | null>(null);
  readonly detailTransactions = signal<KhataTransaction[]>([]);
  readonly detailLoading      = signal(false);
  txSearchQuery               = '';

  /** Transactions filtered by the in-drawer search box */
  readonly filteredTransactions = computed(() => {
    const q = this.txSearchQuery.trim().toLowerCase();
    if (!q) return this.detailTransactions();
    return this.detailTransactions().filter(tx =>
      (tx.notes ?? '').toLowerCase().includes(q)
      || (tx.order_number ?? '').toLowerCase().includes(q)
      || tx.tx_type.toLowerCase().includes(q)
      || fmtPkr(tx.amount).includes(q),
    );
  });

  // ── Modal state ────────────────────────────────────────────────
  readonly modalOpen     = signal(false);
  readonly modalMode     = signal<ModalMode>('record');
  readonly modalCustomer = signal<Customer | null>(null);
  readonly modalLoading  = signal(false);
  readonly modalError    = signal<string | null>(null);
  readonly txType        = signal<'CREDIT' | 'REPAYMENT'>('CREDIT');
  txAmount               = 0;
  txNotes                = '';
  selectedCustomerId     = '';

  readonly addForm = this.fb.nonNullable.group({
    name:  ['', Validators.required],
    phone: [''],
    cnic:  [''],
    notes: [''],
  });

  // ── Lifecycle ──────────────────────────────────────────────────
  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const p = new URLSearchParams({
        page:   String(this.page()),
        status: this.statusFilter(),
        ...(this.searchQuery.trim() ? { search: this.searchQuery.trim() } : {}),
      });
      const data = await this.api.get<{ customers: Customer[]; total: number; kpi: KpiData }>(
        `/api/v1/customers?${p}`,
      );
      this.customers.set(data.customers);
      this.total.set(data.total);
      this.kpi.set(data.kpi);
    } catch { this.toast.error('Failed to load customers.'); }
    finally  { this.loading.set(false); }
  }

  onSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); void this.load(); }, 350);
  }

  setStatus(s: StatusFilter): void { this.statusFilter.set(s); this.page.set(1); void this.load(); }
  setPage(p: number): void         { this.page.set(p); void this.load(); }

  // ── Detail drawer ──────────────────────────────────────────────
  async openDetail(c: Customer): Promise<void> {
    this.detailCustomer.set(c);
    this.detailLoading.set(true);
    this.detailTransactions.set([]);
    this.txSearchQuery = '';
    try {
      const data = await this.api.get<{ transactions: KhataTransaction[] }>(
        `/api/v1/customers/${c.id}/transactions`,
      );
      this.detailTransactions.set(data.transactions);
    } catch { this.toast.error('Failed to load transactions.'); }
    finally  { this.detailLoading.set(false); }
  }

  closeDetail(): void {
    this.detailCustomer.set(null);
    this.detailTransactions.set([]);
    this.txSearchQuery = '';
  }

  async voidTx(tx: KhataTransaction): Promise<void> {
    const c = this.detailCustomer();
    if (!c) return;
    try {
      const res = await this.api.post<{ customer: Customer }>(
        `/api/v1/customers/${c.id}/transactions/${tx.id}/void`, {},
      );
      this.detailTransactions.update(ts =>
        ts.map(t => t.id === tx.id ? { ...t, voided_at: new Date().toISOString() } : t),
      );
      this.detailCustomer.set({ ...c, balance: res.customer.balance });
      this.customers.update(cs =>
        cs.map(cu => cu.id === c.id ? { ...cu, balance: res.customer.balance } : cu),
      );
      this.toast.success('Transaction voided.');
    } catch { this.toast.error('Failed to void transaction.'); }
  }

  // ── Modal ──────────────────────────────────────────────────────
  openRecord(c: Customer): void {
    this.modalMode.set('record');
    this.modalCustomer.set(c);
    this.txType.set('CREDIT');
    this.txAmount = 0; this.txNotes = '';
    this.modalError.set(null); this.modalOpen.set(true);
  }

  openAddCustomer(): void {
    this.modalMode.set('add_customer');
    this.modalCustomer.set(null);
    this.addForm.reset(); this.modalError.set(null); this.modalOpen.set(true);
  }

  closeModal(): void { this.modalOpen.set(false); this.modalError.set(null); }

  async submitTransaction(): Promise<void> {
    const cid = this.modalCustomer()?.id ?? this.selectedCustomerId;
    if (!cid)                             { this.modalError.set('Please select a customer.'); return; }
    if (!this.txAmount || this.txAmount <= 0) { this.modalError.set('Amount must be greater than zero.'); return; }
    this.modalLoading.set(true); this.modalError.set(null);
    try {
      const res = await this.api.post<{ transaction: KhataTransaction; customer: Customer }>(
        `/api/v1/customers/${cid}/transactions`,
        { tx_type: this.txType(), amount: this.txAmount, notes: this.txNotes || null },
      );
      this.customers.update(cs =>
        cs.map(c => c.id === cid ? { ...c, balance: res.customer.balance } : c),
      );
      if (this.detailCustomer()?.id === cid) {
        this.detailCustomer.set({ ...this.detailCustomer()!, balance: res.customer.balance });
        this.detailTransactions.update(ts => [res.transaction, ...ts]);
      }
      void this.load();
      this.toast.success(
        this.txType() === 'CREDIT'
          ? `Credit of ${fmtPkr(this.txAmount)} added.`
          : `Repayment of ${fmtPkr(this.txAmount)} recorded.`,
      );
      this.closeModal();
    } catch (err) {
      this.modalError.set(err instanceof ApiError ? err.message : 'Failed to record transaction.');
    } finally { this.modalLoading.set(false); }
  }

  async submitAddCustomer(): Promise<void> {
    this.addForm.markAllAsTouched();
    if (this.addForm.invalid) return;
    this.modalLoading.set(true); this.modalError.set(null);
    const v = this.addForm.getRawValue();
    try {
      await this.api.post('/api/v1/customers', {
        name:  v.name.trim(), phone: v.phone.trim() || null,
        cnic:  v.cnic.trim() || null, notes: v.notes.trim() || null,
      });
      this.toast.success(`${v.name} added.`);
      this.closeModal(); void this.load();
    } catch (err) {
      this.modalError.set(err instanceof ApiError ? err.message : 'Failed to add customer.');
    } finally { this.modalLoading.set(false); }
  }
}
