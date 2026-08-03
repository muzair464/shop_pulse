import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy, HostListener,
} from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Search, ShoppingCart, Plus, Minus, Trash2, Printer, Loader2, QrCode } from 'lucide-angular';
import { InventoryStore } from '../../core/inventory.store';
import { ShopStore } from '../../core/shop.store';
import { ToastService } from '../../core/toast.service';
import { ApiClient, ApiError } from '../../core/api.client';
import type { InventoryItemRow } from '../../core/database.types';
// Note: no Supabase imports — all data flows through ApiClient

type PaymentMethodType = 'CASH' | 'CARD_KHATA' | 'DIGITAL_PAY';

interface CartLine {
  item: InventoryItemRow;
  qty: number;
  customPrice: number | null; // null = use item.selling_price
}

@Component({
  selector: 'app-pos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, DecimalPipe, DatePipe],
  template: `
    <div class="flex flex-col lg:flex-row gap-4 h-[calc(100vh-9rem)]">

      <!-- ── Catalog Pane ─────────────────────────────────────── -->
      <div class="flex-1 flex flex-col min-h-0 card overflow-hidden">
        <!-- Search + category tabs -->
        <div class="p-4 border-b border-gray-100">
          <div class="relative mb-3">
            <lucide-icon
              [img]="SearchIcon" size="16"
              class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              #searchInput
              type="search"
              [(ngModel)]="searchQuery"
              (ngModelChange)="searchQuery = $event"
              placeholder="Search products… (Cmd+K)"
              class="form-input pl-9 pr-4"
              aria-label="Search products"
            />
          </div>
          <div class="flex gap-1 overflow-x-auto" role="tablist" aria-label="Product categories">
            @for (cat of allCategories(); track cat) {
              <button
                type="button"
                role="tab"
                (click)="activeCategory.set(cat)"
                [attr.aria-selected]="activeCategory() === cat"
                [class.bg-primary-600]="activeCategory() === cat"
                [class.text-white]="activeCategory() === cat"
                class="px-3 py-1 text-xs font-medium rounded-lg border border-gray-200
                       text-gray-600 hover:bg-gray-50 whitespace-nowrap transition-colors"
              >{{ cat }}</button>
            }
          </div>
        </div>

        <!-- Product grid -->
        <div class="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
          @if (filteredProducts().length === 0) {
            <div class="col-span-full py-12 text-center text-sm text-gray-400">
              No products found.
            </div>
          }
          @for (item of filteredProducts(); track item.id) {
            <button
              type="button"
              (click)="addToCart(item)"
              [disabled]="item.stock === 0"
              class="group flex flex-col p-3 rounded-xl border border-gray-200 bg-white text-left
                     hover:border-primary-400 hover:shadow-sm
                     disabled:opacity-50 disabled:cursor-not-allowed
                     active:scale-95 transition-all"
              [attr.aria-label]="'Add ' + item.name + ' to cart'"
            >
              <div class="flex items-start justify-between mb-1.5">
                <span
                  class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                  [class.bg-blue-100]="item.classification === 'NEW'"
                  [class.text-blue-700]="item.classification === 'NEW'"
                  [class.bg-yellow-100]="item.classification === 'USED'"
                  [class.text-yellow-700]="item.classification === 'USED'"
                >{{ item.classification === 'NEW' ? 'New' : 'Used' }}</span>
                <span
                  class="text-[10px] font-medium"
                  [class.text-green-600]="item.stock > 5"
                  [class.text-yellow-600]="item.stock > 0 && item.stock <= 5"
                  [class.text-red-500]="item.stock === 0"
                >{{ item.stock === 0 ? 'Out' : item.stock + ' left' }}</span>
              </div>
              <p class="text-sm font-semibold text-gray-800 leading-tight line-clamp-2 mb-1">
                {{ item.name }}
              </p>
              <p class="text-xs text-gray-400 mb-2">{{ item.category }}</p>
              <p class="mt-auto text-sm font-bold text-primary-700 tabular-nums">
                {{ item.selling_price | number:'1.0-0' }}
              </p>
            </button>
          }
        </div>
      </div>

      <!-- ── Cart Pane ────────────────────────────────────────── -->
      <div class="w-full lg:w-96 flex flex-col card overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <lucide-icon [img]="CartIcon" size="16" class="text-gray-500" aria-hidden="true" />
          <h2 class="font-semibold text-gray-800 text-sm">Cart</h2>
          @if (cart().length > 0) {
            <span class="ml-auto text-xs text-gray-400">{{ cart().length }} item(s)</span>
            <button
              type="button"
              (click)="clearCart()"
              class="text-xs text-red-400 hover:text-red-600 transition-colors ml-1"
              aria-label="Clear cart"
            >Clear</button>
          }
        </div>

        <!-- Cart lines -->
        <div class="flex-1 overflow-y-auto divide-y divide-gray-100">
          @if (cart().length === 0) {
            <div class="py-12 text-center text-sm text-gray-400">
              <lucide-icon [img]="CartIcon" size="32" class="mx-auto mb-2 text-gray-200" aria-hidden="true" />
              Cart is empty
            </div>
          }
          @for (line of cart(); track line.item.id) {
            <div class="px-4 py-3">
              <div class="flex items-start justify-between gap-2 mb-2">
                <p class="text-sm font-medium text-gray-800 leading-tight">
                  {{ line.item.name }}
                </p>
                <button
                  type="button"
                  (click)="removeLine(line)"
                  class="flex-shrink-0 p-1 text-gray-300 hover:text-red-500 transition-colors"
                  [attr.aria-label]="'Remove ' + line.item.name + ' from cart'"
                >
                  <lucide-icon [img]="Trash2Icon" size="13" aria-hidden="true" />
                </button>
              </div>
              <div class="flex items-center justify-between">
                <!-- Qty stepper -->
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    (click)="decQty(line)"
                    class="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center
                           text-gray-500 hover:bg-gray-100 transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <lucide-icon [img]="MinusIcon" size="11" aria-hidden="true" />
                  </button>
                  <span class="text-sm font-semibold tabular-nums w-6 text-center">{{ line.qty }}</span>
                  <button
                    type="button"
                    (click)="incQty(line)"
                    [disabled]="line.qty >= line.item.stock"
                    class="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center
                           text-gray-500 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                    aria-label="Increase quantity"
                  >
                    <lucide-icon [img]="PlusIcon" size="11" aria-hidden="true" />
                  </button>
                </div>
                <!-- Custom price override -->
                <div class="flex items-center gap-1">
                  <span class="text-xs text-gray-400">PKR</span>
                  <input
                    type="number"
                    [value]="linePrice(line)"
                    (change)="setCustomPrice(line, $event)"
                    min="0"
                    class="w-24 text-sm font-semibold text-right tabular-nums rounded-lg border
                           border-gray-200 px-2 py-1 focus:outline-none focus:border-primary-400"
                    [attr.aria-label]="'Price for ' + line.item.name"
                  />
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Totals -->
        @if (cart().length > 0) {
          <div class="border-t border-gray-100 px-4 py-3 space-y-1.5">
            <div class="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span class="tabular-nums">{{ subtotal() | number:'1.0-0' }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-500">Discount</span>
              <input
                type="number"
                [(ngModel)]="discount"
                min="0"
                class="w-24 text-sm font-medium text-right tabular-nums rounded-lg border
                       border-gray-200 px-2 py-1 focus:outline-none focus:border-primary-400"
                aria-label="Discount amount"
              />
            </div>
            <div class="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-100">
              <span>Total</span>
              <span class="tabular-nums">{{ total() | number:'1.0-0' }}</span>
            </div>
          </div>
        }

        <!-- Payment method tabs -->
        @if (cart().length > 0) {
          <div class="border-t border-gray-100 px-4 py-3">
            <p class="text-xs font-medium text-gray-500 mb-2">Payment Method</p>
            <div class="flex gap-1">
              @for (pm of paymentMethods; track pm.value) {
                <button
                  type="button"
                  (click)="paymentMethod.set(pm.value)"
                  [class.bg-primary-600]="paymentMethod() === pm.value"
                  [class.text-white]="paymentMethod() === pm.value"
                  [class.border-primary-600]="paymentMethod() === pm.value"
                  class="flex-1 py-1.5 text-xs font-medium rounded-lg border border-gray-200
                         text-gray-600 hover:bg-gray-50 transition-colors"
                  [attr.aria-pressed]="paymentMethod() === pm.value"
                >{{ pm.label }}</button>
              }
            </div>

            <!-- Digital Pay QR panel -->
            @if (paymentMethod() === 'DIGITAL_PAY') {
              <div class="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-200 text-center">
                @if (qrDataUri()) {
                  <img
                    [src]="qrDataUri()"
                    alt="Payment QR code"
                    class="mx-auto max-w-[140px] rounded"
                  />
                  <p class="text-xs text-gray-400 mt-1.5">Show to customer</p>
                } @else {
                  <lucide-icon [img]="QrCodeIcon" size="32" class="mx-auto text-gray-300 mb-1" aria-hidden="true" />
                  <p class="text-xs text-gray-400">No QR uploaded. Add one in Settings.</p>
                }
              </div>
            }
          </div>

          <!-- Complete sale button -->
          <div class="px-4 pb-4">
            <button
              type="button"
              (click)="completeSale()"
              [disabled]="checkoutLoading()"
              class="btn-primary w-full justify-center py-3 text-base"
              [attr.aria-busy]="checkoutLoading()"
            >
              @if (checkoutLoading()) {
                <lucide-icon [img]="Loader2Icon" size="18" class="animate-spin" aria-hidden="true" />
                Processing…
              } @else {
                <lucide-icon [img]="PrinterIcon" size="18" aria-hidden="true" />
                Complete Sale &amp; Print
              }
            </button>
          </div>
        }
      </div>
    </div>

    <!-- Print receipt (hidden on screen, shown on print) -->
    @if (lastOrder()) {
      <div class="print-receipt hidden">
        <div class="text-center font-bold text-lg mb-2">{{ shopStore.shopName() }}</div>
        <div class="receipt-divider"></div>
        <div class="text-xs mb-1">Order: {{ lastOrder()!.order_number }}</div>
        <div class="text-xs mb-2">Date: {{ lastOrder()!.created_at | date:'MMM d, y h:mm a' }}</div>
        <div class="receipt-divider"></div>
        @for (line of lastOrder()!.items; track line.inventoryId) {
          <div class="receipt-row text-xs py-0.5">
            <span>{{ line.nameSnapshot }} ×{{ line.qty }}</span>
            <span>{{ line.lineTotal | number:'1.0-0' }}</span>
          </div>
        }
        <div class="receipt-divider"></div>
        @if (lastOrder()!.discount > 0) {
          <div class="receipt-row text-xs">
            <span>Discount</span><span>-{{ lastOrder()!.discount | number:'1.0-0' }}</span>
          </div>
        }
        <div class="receipt-row text-sm font-bold mt-1">
          <span>TOTAL</span><span>{{ lastOrder()!.total | number:'1.0-0' }}</span>
        </div>
        <div class="receipt-divider"></div>
        <div class="text-center text-xs mt-2">Thank you!</div>
      </div>
    }
  `,
})
export class PosComponent implements OnInit {
  private readonly inventoryStore = inject(InventoryStore);
  readonly shopStore = inject(ShopStore);
  private readonly toast = inject(ToastService);
  private readonly api = inject(ApiClient);

  readonly SearchIcon = Search;
  readonly CartIcon = ShoppingCart;
  readonly PlusIcon = Plus;
  readonly MinusIcon = Minus;
  readonly Trash2Icon = Trash2;
  readonly PrinterIcon = Printer;
  readonly Loader2Icon = Loader2;
  readonly QrCodeIcon = QrCode;

  // ── State ─────────────────────────────────────────────────
  searchQuery = '';
  discount = 0;
  readonly activeCategory = signal<string>('All');
  readonly cart = signal<CartLine[]>([]);
  readonly paymentMethod = signal<PaymentMethodType>('CASH');
  readonly checkoutLoading = signal(false);
  readonly lastOrder = signal<null | {
    order_number: string;
    created_at: string;
    discount: number;
    total: number;
    items: Array<{ inventoryId: string; nameSnapshot: string; qty: number; lineTotal: number }>;
  }>(null);

  readonly paymentMethods: { label: string; value: PaymentMethodType }[] = [
    { label: 'Cash', value: 'CASH' },
    { label: 'Card/Khata', value: 'CARD_KHATA' },
    { label: 'Digital Pay', value: 'DIGITAL_PAY' },
  ];

  // ── Derived ───────────────────────────────────────────────
  readonly allCategories = computed(() => {
    const cats = [...new Set(this.inventoryStore.items().map(i => i.category))].sort();
    return ['All', ...cats];
  });

  readonly filteredProducts = computed(() => {
    const q = this.searchQuery.toLowerCase();
    const cat = this.activeCategory();
    return this.inventoryStore.items().filter(i => {
      const matchCat = cat === 'All' || i.category === cat;
      const matchQ = !q || i.name.toLowerCase().includes(q)
        || i.category.toLowerCase().includes(q)
        || (i.imei ?? '').includes(q);
      return matchCat && matchQ;
    });
  });

  readonly subtotal = computed(() =>
    this.cart().reduce((s, l) => s + this.linePrice(l) * l.qty, 0),
  );

  readonly total = computed(() => Math.max(0, this.subtotal() - this.discount));

  readonly qrDataUri = computed(() => {
    return this.shopStore.paymentQrDataUri();
  });

  // ── Cmd+K focus search ────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const el = document.querySelector<HTMLInputElement>('input[type="search"]');
      el?.focus();
    }
  }

  async ngOnInit(): Promise<void> {
    if (!this.shopStore.shopId()) {
      await this.shopStore.load();
    }
    const shopId = this.shopStore.shopId();
    if (shopId && this.inventoryStore.items().length === 0) {
      await this.inventoryStore.load(shopId);
    }
  }

  addToCart(item: InventoryItemRow): void {
    if (item.stock === 0) return;
    this.cart.update(lines => {
      const existing = lines.find(l => l.item.id === item.id);
      if (existing) {
        if (existing.qty >= item.stock) {
          this.toast.warning('No more stock available for this item.');
          return lines;
        }
        return lines.map(l =>
          l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [...lines, { item, qty: 1, customPrice: null }];
    });
  }

  removeLine(line: CartLine): void {
    this.cart.update(lines => lines.filter(l => l.item.id !== line.item.id));
  }

  incQty(line: CartLine): void {
    if (line.qty >= line.item.stock) return;
    this.cart.update(lines =>
      lines.map(l => l.item.id === line.item.id ? { ...l, qty: l.qty + 1 } : l),
    );
  }

  decQty(line: CartLine): void {
    if (line.qty <= 1) {
      this.removeLine(line);
      return;
    }
    this.cart.update(lines =>
      lines.map(l => l.item.id === line.item.id ? { ...l, qty: l.qty - 1 } : l),
    );
  }

  setCustomPrice(line: CartLine, event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    this.cart.update(lines =>
      lines.map(l =>
        l.item.id === line.item.id
          ? { ...l, customPrice: isNaN(val) || val < 0 ? null : val }
          : l,
      ),
    );
  }

  linePrice(line: CartLine): number {
    return line.customPrice !== null ? line.customPrice : line.item.selling_price;
  }

  clearCart(): void {
    this.cart.set([]);
    this.discount = 0;
  }

  async completeSale(): Promise<void> {
    const lines = this.cart();
    if (lines.length === 0) return;

    this.checkoutLoading.set(true);

    const idempotencyKey = crypto.randomUUID();
    const items = lines.map(l => ({
      inventoryId: l.item.id,
      qty: l.qty,
      unitPrice: this.linePrice(l),
      nameSnapshot: l.item.name,
    }));

    try {
      const result = await this.api.post<{ order: Record<string, unknown> }>(
        '/api/v1/pos/checkout',
        {
          items,
          discount: this.discount,
          paymentMethod: this.paymentMethod(),
          idempotencyKey,
        },
        idempotencyKey,
      );

      const order = result.order as {
        order_number: string;
        created_at: string;
        discount: number;
        total: number;
      };

      this.lastOrder.set({
        order_number: order.order_number,
        created_at: order.created_at,
        discount: order.discount,
        total: order.total,
        items: items.map(i => ({
          inventoryId: i.inventoryId,
          nameSnapshot: i.nameSnapshot,
          qty: i.qty,
          lineTotal: i.qty * i.unitPrice,
        })),
      });

      this.clearCart();
      this.toast.success(`Order ${order.order_number} completed.`);
      setTimeout(() => window.print(), 150);
    } catch (err) {
      if (err instanceof ApiError && err.isConflict) {
        this.toast.error('Stock changed — please refresh and check item quantities.');
      } else {
        this.toast.error('Checkout failed. Please try again.');
      }
    } finally {
      this.checkoutLoading.set(false);
    }
  }
}
