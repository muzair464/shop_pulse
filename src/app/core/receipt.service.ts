import { Injectable, inject } from '@angular/core';
import { ShopStore } from './shop.store';

export interface ReceiptOrder {
  order_number:  string;
  created_at:    string;
  subtotal:      number;
  discount:      number;
  total:         number;
  payment_method: string;
  customer_name:  string | null;
  customer_phone: string | null;
  customer_cnic:  string | null;
  order_items: Array<{
    name_snapshot:  string;
    description:    string | null;
    qty:            number;
    unit_price:     number;
    line_total:     number;
  }>;
}

@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private readonly shopStore = inject(ShopStore);

  private readonly paymentLabels: Record<string, string> = {
    CASH: 'Cash',
    CARD_KHATA: 'Card / Khata',
    DIGITAL_PAY: 'Digital Pay',
  };

  paymentLabel(method: string): string {
    return this.paymentLabels[method] ?? method;
  }

  print(order: ReceiptOrder): void {
    const shop = this.shopStore.shop();
    console.log('[Receipt] Shop data:', shop); // Debug log
    console.log('[Receipt] Footer message:', shop?.receiptFooterMessage); // Debug log
    const fmt  = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    const date = new Date(order.created_at);
    const d = (cls: string, inner: string) => `<div class="${cls}">${inner}</div>`;
    const r = (label: string, val: string) =>
      `<div class="rct-row"><span>${label}</span><span>${val}</span></div>`;

    let html = '';

    // Branding
    html += d('rct-brand', 'ShopPulse');
    html += '<div class="rct-divider"></div>';

    // Shop info
    html += d('rct-shop-name', shop?.shopName ?? '');
    if (shop?.phone)   html += d('rct-line', `Tel: ${shop.phone}`);
    if (shop?.address) html += d('rct-line', shop.address);
    html += '<div class="rct-divider"></div>';

    // Order header
    html += r('Order #', order.order_number);
    html += r('Date', date.toLocaleDateString('en-GB'));
    html += r('Time', date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
    html += r('Payment', this.paymentLabel(order.payment_method));
    html += '<div class="rct-divider"></div>';

    // Customer (optional)
    if (order.customer_name || order.customer_phone || order.customer_cnic) {
      html += d('rct-section-label', 'CUSTOMER');
      if (order.customer_name)  html += r('Name',  order.customer_name);
      if (order.customer_phone) html += r('Phone', order.customer_phone);
      if (order.customer_cnic)  html += r('CNIC',  order.customer_cnic);
      html += '<div class="rct-divider"></div>';
    }

    // Items
    html += d('rct-section-label', 'ITEMS');
    for (const item of order.order_items) {
      html += d('rct-item-name', item.name_snapshot);
      if (item.description) html += d('rct-item-desc', item.description);
      html += `<div class="rct-row rct-item-detail">` +
        `<span>${item.qty} x ${fmt(item.unit_price)}</span>` +
        `<span>${fmt(item.line_total)}</span></div>`;
    }
    html += '<div class="rct-divider"></div>';

    // Totals
    html += r('Subtotal', fmt(order.subtotal));
    if (order.discount > 0) html += r('Discount', `-${fmt(order.discount)}`);
    html += '<div class="rct-divider"></div>';
    html += `<div class="rct-row rct-total">` +
      `<span>TOTAL (PKR)</span><span>${fmt(order.total)}</span></div>`;
    html += '<div class="rct-divider"></div>';

    // Footer
    // Use custom footer message from shop settings, or default message
    const footerMessage = shop?.receiptFooterMessage || 'Thank you for your purchase!';
    html += d('rct-footer', footerMessage);
    html += d('rct-footer rct-footer-brand', 'Powered by ShopPulse');

    // Inject into static container — bypasses Angular change detection entirely
    let container = document.getElementById('sp-receipt-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'sp-receipt-container';
      container.className = 'print-receipt';
      document.body.appendChild(container);
    }
    container.innerHTML = html;

    const prev = document.title;
    document.title = order.order_number;
    window.print();
    document.title = prev;
  }
}
