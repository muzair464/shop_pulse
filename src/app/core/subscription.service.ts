import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiClient } from './api.client';

export interface SystemPaymentSettings {
  monthly_fee: number;
  bank_name: string;
  account_title: string;
  account_number: string;
  iban: string;
  easypaisa_title: string;
  easypaisa_number: string;
  instructions: string;
  paymentQrDataUri: string | null;
}

export interface SubscriptionInfo {
  status: 'active' | 'expired' | 'pending_verification' | 'trial';
  expiresAt: string | null;
  isSubscriptionActive: boolean;
  monthlyFee: number;
}

export interface SubscriptionPaymentRecord {
  id: string;
  amount: number;
  payment_method: 'EASYPAISA' | 'BANK';
  transaction_id: string;
  sender_account: string | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  verified_at: string | null;
  created_at: string;
  receiptDataUri?: string | null;
  shop_name?: string;
  shop_phone?: string;
  owner_email?: string;
}

export interface SubscriptionResponse {
  systemSettings: SystemPaymentSettings;
  subscription: SubscriptionInfo;
  payments: SubscriptionPaymentRecord[];
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly api = inject(ApiClient);

  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _data = signal<SubscriptionResponse | null>(null);

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly data = this._data.asReadonly();

  readonly subscription = computed(() => this._data()?.subscription ?? null);
  readonly systemSettings = computed(() => this._data()?.systemSettings ?? null);
  readonly payments = computed(() => this._data()?.payments ?? []);

  readonly isDown = computed(() => {
    const sub = this._data()?.subscription;
    if (!sub) return false;
    return !sub.isSubscriptionActive;
  });

  async load(): Promise<SubscriptionResponse | null> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const res = await this.api.get<SubscriptionResponse>('/api/v1/subscription');
      this._data.set(res);
      return res;
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : 'Failed to load subscription details.');
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  async submitPayment(payload: {
    amount: number;
    paymentMethod: 'EASYPAISA' | 'BANK';
    transactionId: string;
    senderAccount?: string | null;
    receiptBase64?: string | null;
    notes?: string | null;
  }): Promise<{ message: string; payment: SubscriptionPaymentRecord }> {
    const res = await this.api.post<{ message: string; payment: SubscriptionPaymentRecord }>(
      '/api/v1/subscription',
      payload,
    );
    // Reload state after submission
    await this.load();
    return res;
  }

  // Admin APIs
  async loadAdminPayments(): Promise<SubscriptionPaymentRecord[]> {
    const res = await this.api.get<{ payments: SubscriptionPaymentRecord[] }>(
      '/api/v1/subscription/admin',
    );
    return res.payments;
  }

  async verifyPayment(paymentId: string, action: 'approve' | 'reject', adminNotes?: string): Promise<void> {
    await this.api.post('/api/v1/subscription/admin', {
      paymentId,
      action,
      adminNotes,
    });
    await this.load();
  }

  async updateSystemSettings(settings: Partial<SystemPaymentSettings> & { paymentQrBase64?: string | null }): Promise<void> {
    await this.api.patch('/api/v1/subscription/admin/settings', settings);
    await this.load();
  }
}
