import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
  HostListener, ViewChild, ElementRef, ChangeDetectorRef,
} from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule, Search, ShoppingCart, Plus, Minus,
  Trash2, Printer, Loader2, QrCode, User, ChevronDown, ChevronUp,
  BookOpen, Check, X,
} from 'lucide-angular';
import { InventoryStore } from '../../core/inventory.store';
import { ShopStore } from '../../core/shop.store';
import { OrdersStore } from '../../core/orders.store';
import { ToastService } from '../../core/toast.service';
import { ApiClient, ApiError } from '../../core/api.client';
import { ReceiptService } from '../../core/receipt.service';
import type { InventoryItemRow } from '../../core/database.types';

type PaymentMethodType = 'CASH' | 'CARD_KHATA' | 'DIGITAL_PAY';
interface CartLine  { item: InventoryItemRow; qty: number; customPrice: number | null; }
interface CustomerInfo { name: string; phone: string; cnic: string; }
interface KhataCustomer { id: string; name: string; phone: string | null; balance: number; }

@Component({
  selector: 'app-pos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, DecimalPipe, DatePipe],
  template: `
  <!-- Outer: full viewport height minus nav, flex col on mobile, flex row on lg -->
  <div class="flex flex-col lg:flex-row gap-3 h-[calc(100vh-3.5rem-4rem)] lg:h-[calc(100vh-3.5rem-2rem)] min-h-0">

    <!-- â”€â”€ Catalog pane â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
    <div class="flex flex-col min-h-0 card overflow-hidden"
         [class.flex-1]="!cartExpanded()"
         [class.hidden]="cartExpanded() && isMobile">

      <!-- Search + categories -->
      <div class="p-3 border-b border-gray-100 shrink-0">
        <div class="relative mb-2">
          <lucide-icon [img]="SearchIcon" size="15"
            class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            aria-hidden="true" />
          <input #searchInput type="search"
            [ngModel]="searchQuery()"
            (ngModelChange)="onSearchChange($event)"
            (keydown)="onSearchKeydown($event)"
            placeholder="  Search productsâ€¦ (Alt+K)"
            class="form-input pl-9 pr-4 text-sm"
            aria-label="Search products"
            aria-autocomplete="list"
            [attr.aria-activedescendant]="focusedIdx() >= 0 ? 'prod-' + focusedIdx() : null" />
        </div>
        <div class="flex gap-1 overflow-x-auto pb-1 scrollbar-hide" role="tablist">
          @for (cat of allCategories(); track cat) {
            <button type="button" role="tab"
              (click)="setCategory(cat)"
              class="px-2.5 py-1 text-xs font-medium rounded-lg border whitespace-nowrap
                     transition-colors shrink-0"
              [class]="activeCategory() === cat
                ? 'bg-primary-600 text-white border-primary-600 hover:bg-primary-700'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-800'">
              {{ cat }}
            </button>
          }
        </div>
      </div>

      <!-- Product grid -->
      <div class="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 content-start"
           role="listbox" aria-label="Products">
        @if (filteredProducts().length === 0) {
          <div class="col-span-full py-10 text-center text-sm text-gray-400">No products found.</div>
        }
        @for (item of filteredProducts(); track item.id; let i = $index) {
          <button type="button"
            [id]="'prod-' + i"
            (click)="addToCart(item)"
            (mouseenter)="focusedIdx.set(i)"
            [disabled]="item.stock === 0"
            class="flex flex-col p-2.5 rounded-xl border-2 bg-white text-left transition-all
                   hover:border-primary-400 hover:shadow-sm
                   disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            [class.border-blue-500]="focusedIdx() === i"
            [class.shadow-md]="focusedIdx() === i"
            [class.border-gray-200]="focusedIdx() !== i"
            [attr.aria-label]="'Add ' + item.name + ' to cart'"
            role="option"
            [attr.aria-selected]="focusedIdx() === i">
            <div class="flex items-start justify-between mb-1 gap-1">
              <span class="text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded shrink-0"
                [class.bg-blue-100]="item.classification === 'NEW'"
                [class.text-blue-700]="item.classification === 'NEW'"
                [class.bg-yellow-100]="item.classification === 'USED'"
                [class.text-yellow-700]="item.classification === 'USED'">
                {{ item.classification === 'NEW' ? 'New' : 'Used' }}
              </span>
              <span class="text-[9px] font-medium shrink-0"
                [class.text-green-600]="item.stock > 5"
                [class.text-yellow-600]="item.stock > 0 && item.stock <= 5"
                [class.text-red-500]="item.stock === 0">
                {{ item.stock === 0 ? 'Out' : item.stock }}
              </span>
            </div>
            <p class="text-xs font-semibold text-gray-800 leading-tight line-clamp-2 mb-1 min-h-[2rem]">
              {{ item.name }}
            </p>
            @if (item.description) {
              <p class="text-[10px] text-gray-400 line-clamp-1 mb-0.5">{{ item.description }}</p>
            }
            <p class="text-[10px] text-gray-400 truncate mb-1.5">{{ item.category }}</p>
            <p class="mt-auto text-sm font-bold text-primary-700 tabular-nums">
              {{ item.selling_price | number:'1.0-0' }}
            </p>
          </button>
        }
      </div>
    </div>

    <!-- â”€â”€ Cart pane â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
    <!-- On mobile: fixed bottom sheet toggled by cartExpanded signal   -->
    <!-- On desktop: fixed right column, always visible                 -->
    <div class="lg:w-96 flex flex-col card overflow-hidden shrink-0"
         [class.flex-1]="cartExpanded() && isMobile"
         [class.hidden]="!cartExpanded() && isMobile">

      <!-- Cart header -->
      <div class="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2 shrink-0">
        <lucide-icon [img]="CartIcon" size="15" class="text-gray-500 shrink-0" aria-hidden="true" />
        <h2 class="font-semibold text-gray-800 text-sm">Cart</h2>
        @if (cart().length > 0) {
          <span class="ml-1 text-xs bg-primary-100 text-primary-700 font-bold
                        rounded-full px-1.5 py-0.5 leading-none">
            {{ cart().length }}
          </span>
          <button type="button" (click)="clearCart()"
            class="text-xs text-red-400 hover:text-red-600 transition-colors ml-auto"
            aria-label="Clear cart">Clear</button>
        } @else {
          <span class="ml-auto text-xs text-gray-400">Empty</span>
        }
      </div>

      <!-- Cart lines -->
      <div class="flex-1 overflow-y-auto divide-y divide-gray-100 min-h-0">
        @if (cart().length === 0) {
          <div class="py-8 text-center text-sm text-gray-400">
            <lucide-icon [img]="CartIcon" size="28" class="mx-auto mb-2 text-gray-200" aria-hidden="true" />
            Cart is empty
          </div>
        }
        @for (line of cart(); track line.item.id) {
          <div class="px-3 py-2.5">
            <div class="flex items-start justify-between gap-2 mb-1.5">
              <div class="flex-1 min-w-0">
                <p class="text-xs font-medium text-gray-800 leading-snug line-clamp-2">
                  {{ line.item.name }}
                </p>
                @if (line.item.description) {
                  <p class="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{{ line.item.description }}</p>
                }
              </div>
              <button type="button" (click)="removeLine(line)"
                class="shrink-0 p-1 text-gray-300 hover:text-red-500 transition-colors"
                [attr.aria-label]="'Remove ' + line.item.name">
                <lucide-icon [img]="Trash2Icon" size="12" aria-hidden="true" />
              </button>
            </div>
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5">
                <button type="button" (click)="decQty(line)"
                  class="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center
                         text-gray-500 hover:bg-gray-100 transition-colors"
                  aria-label="Decrease quantity">
                  <lucide-icon [img]="MinusIcon" size="10" aria-hidden="true" />
                </button>
                <span class="text-xs font-bold tabular-nums w-5 text-center">{{ line.qty }}</span>
                <button type="button" (click)="incQty(line)" [disabled]="line.qty >= line.item.stock"
                  class="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center
                         text-gray-500 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                  aria-label="Increase quantity">
                  <lucide-icon [img]="PlusIcon" size="10" aria-hidden="true" />
                </button>
              </div>
              <div class="flex items-center gap-1">
                <span class="text-[10px] text-gray-400">PKR</span>
                <input type="number" [value]="linePrice(line)" (change)="setCustomPrice(line, $event)"
                  min="0"
                  class="w-20 text-xs font-semibold text-right tabular-nums rounded-md border
                         border-gray-200 px-1.5 py-1 focus:outline-none focus:border-primary-400"
                  [attr.aria-label]="'Price for ' + line.item.name" />
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Customer + Khata section -->
      @if (cart().length > 0) {
        <div class="border-t border-gray-100 px-3 py-2 shrink-0">
          <button type="button" (click)="customerOpen.set(!customerOpen())"
            class="flex items-center gap-1.5 text-xs font-medium text-gray-500
                   hover:text-gray-700 w-full text-left">
            <lucide-icon [img]="UserIcon" size="12" aria-hidden="true" />
            Customer / Khata
            @if (linkedCustomer()) {
              <span class="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-100
                           text-amber-700 text-[9px] font-bold">
                {{ linkedCustomer()!.name }}
              </span>
            }
            <lucide-icon [img]="customerOpen() ? ChevronUpIcon : ChevronDownIcon"
              size="12" class="ml-auto" aria-hidden="true" />
          </button>

          @if (customerOpen()) {
            <div class="mt-2 space-y-2">

              <!-- Customer search -->
              <div class="relative">
                <lucide-icon [img]="SearchIcon" size="12"
                  class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  aria-hidden="true"/>
                <input type="search"
                  [value]="customerSearch()"
                  (input)="onCustomerSearch($event)"
                  placeholder="Search customer by name or phone..."
                  class="form-input pl-7 text-xs py-1.5"
                  aria-label="Search customer"/>
              </div>

              <!-- Dropdown results -->
              @if (customerResults().length > 0 && !linkedCustomer()) {
                <div class="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  @for (c of customerResults(); track c.id) {
                    <button type="button" (click)="linkCustomer(c)"
                      class="w-full flex items-center justify-between px-3 py-2 text-left
                             hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                      <div class="min-w-0">
                        <p class="text-xs font-semibold text-gray-800 truncate">{{ c.name }}</p>
                        @if (c.phone) {
                          <p class="text-[10px] text-gray-400">{{ c.phone }}</p>
                        }
                      </div>
                      <span class="text-[10px] font-semibold tabular-nums ml-2 shrink-0"
                        [class.text-red-600]="c.balance > 0"
                        [class.text-gray-500]="c.balance <= 0">
                        PKR {{ c.balance | number:'1.0-0' }}
                      </span>
                    </button>
                  }
                </div>
              }

              <!-- Linked customer chip -->
              @if (linkedCustomer()) {
                <div class="flex items-center gap-2 px-2.5 py-2 rounded-lg
                            bg-amber-50 border border-amber-200">
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-semibold text-amber-800 truncate">
                      {{ linkedCustomer()!.name }}
                    </p>
                    @if (linkedCustomer()!.phone) {
                      <p class="text-[10px] text-amber-600">{{ linkedCustomer()!.phone }}</p>
                    }
                    <p class="text-[10px] text-amber-700 mt-0.5">
                      Balance: PKR {{ linkedCustomer()!.balance | number:'1.0-0' }}
                    </p>
                  </div>
                  <button type="button" (click)="unlinkCustomer()"
                    class="p-1 text-amber-400 hover:text-amber-700 transition-colors"
                    aria-label="Remove linked customer">
                    <lucide-icon [img]="XIcon" size="13" aria-hidden="true"/>
                  </button>
                </div>
              }

              <!-- New customer fields (shown when no match found) -->
              @if (!linkedCustomer() && customerSearch().trim().length > 1 && !customerResults().length) {
                <div class="space-y-1.5 pt-0.5">
                  <p class="text-[10px] text-gray-400 font-medium">
                    No match â€” fill to create new customer:
                  </p>
                  <input type="text" [(ngModel)]="customer.name"
                    placeholder="Full name (required)"
                    class="form-input text-xs py-1.5" aria-label="Customer name"/>
                  <input type="tel" [(ngModel)]="customer.phone"
                    placeholder="Phone (optional)"
                    class="form-input text-xs py-1.5" aria-label="Customer phone"/>
                  <input type="text" [(ngModel)]="customer.cnic"
                    placeholder="CNIC (optional)"
                    class="form-input text-xs py-1.5" aria-label="Customer CNIC"/>
                </div>
              }

              <!-- Add to Khata toggle â€” available for any payment method -->
              @if (linkedCustomer() || customer.name.trim()) {
                <label class="flex items-center gap-2 pt-0.5 cursor-pointer select-none">
                  <button type="button" role="switch"
                    [attr.aria-checked]="addToKhata()"
                    (click)="addToKhata.set(!addToKhata())"
                    class="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2
                           border-transparent transition-colors focus:outline-none
                           focus:ring-2 focus:ring-amber-500/40"
                    [class.bg-amber-500]="addToKhata()"
                    [class.bg-gray-200]="!addToKhata()">
                    <span class="pointer-events-none inline-block h-4 w-4 transform
                                 rounded-full bg-white shadow ring-0 transition-transform"
                      [class.translate-x-4]="addToKhata()"
                      [class.translate-x-0]="!addToKhata()">
                    </span>
                  </button>
                  <div class="flex items-center gap-1">
                    <lucide-icon [img]="BookOpenIcon" size="11"
                      class="text-amber-600" aria-hidden="true"/>
                    <span class="text-xs text-amber-700 font-medium">
                      Add PKR {{ total() | number:'1.0-0' }} to Khata
                    </span>
                  </div>
                </label>
              }
            </div>
          }
        </div>
      }

      <!-- Totals -->
      @if (cart().length > 0) {
        <div class="border-t border-gray-100 px-3 py-2.5 space-y-1.5 shrink-0">
          <div class="flex justify-between text-xs text-gray-500">
            <span>Subtotal</span>
            <span class="tabular-nums">{{ subtotal() | number:'1.0-0' }}</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-500">Discount</span>
            <input type="number" [ngModel]="discount()" (ngModelChange)="discount.set(+$event || 0)"
              min="0" [max]="subtotal()"
              class="w-20 text-xs font-medium text-right tabular-nums rounded-md border
                     border-gray-200 px-1.5 py-1 focus:outline-none focus:border-primary-400"
              aria-label="Discount amount" />
          </div>
          @if (discount() > 0) {
            <div class="flex justify-between text-xs text-green-600">
              <span>Saving</span>
              <span class="tabular-nums">-{{ discount() | number:'1.0-0' }}</span>
            </div>
          }
          <div class="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-100">
            <span>Total</span>
            <span class="tabular-nums">{{ total() | number:'1.0-0' }}</span>
          </div>
        </div>

        <!-- Payment methods -->
        <div class="border-t border-gray-100 px-3 py-2.5 shrink-0">
          <p class="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Payment</p>
          <div class="flex gap-1">
            @for (pm of paymentMethods; track pm.value) {
              <button type="button" (click)="paymentMethod.set(pm.value)"
                class="flex-1 py-1.5 text-[10px] font-semibold rounded-lg border
                       transition-colors"
                [class]="paymentMethod() === pm.value
                  ? 'bg-primary-600 text-white border-primary-600 hover:bg-primary-700'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-800'"
                [attr.aria-pressed]="paymentMethod() === pm.value">
                {{ pm.label }}
              </button>
            }
          </div>
          @if (paymentMethod() === 'DIGITAL_PAY') {
            <div class="mt-2 p-2 rounded-lg bg-gray-50 border border-gray-200 text-center">
              @if (qrDataUri()) {
                <img [src]="qrDataUri()!" alt="Payment QR" class="mx-auto max-w-[100px] rounded" />
                <p class="text-[10px] text-gray-400 mt-1">Show to customer</p>
              } @else {
                <lucide-icon [img]="QrCodeIcon" size="24" class="mx-auto text-gray-300 mb-1" aria-hidden="true" />
                <p class="text-[10px] text-gray-400">No QR uploaded. Add in Settings.</p>
              }
            </div>
          }
        </div>

        <!-- Complete sale -->
        <div class="px-3 pb-3 shrink-0">
          <button type="button" (click)="completeSale()" [disabled]="checkoutLoading()"
            class="btn-primary w-full justify-center py-2.5 text-sm"
            [attr.aria-busy]="checkoutLoading()">
            @if (checkoutLoading()) {
              <lucide-icon [img]="Loader2Icon" size="16" class="animate-spin" aria-hidden="true" />
              Processingâ€¦
            } @else {
              <lucide-icon [img]="PrinterIcon" size="16" aria-hidden="true" />
              Complete &amp; Print
            }
          </button>
        </div>
      }
    </div>
  </div>

  <!-- â”€â”€ Mobile cart toggle FAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
  <button type="button"
    class="lg:hidden fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full shadow-lg
           bg-primary-600 text-white flex items-center justify-center
           active:scale-95 transition-all"
    (click)="cartExpanded.set(!cartExpanded())"
    [attr.aria-label]="cartExpanded() ? 'Show products' : 'Show cart'">
    @if (cartExpanded()) {
      <lucide-icon [img]="SearchIcon" size="22" aria-hidden="true" />
    } @else {
      <div class="relative">
        <lucide-icon [img]="CartIcon" size="22" aria-hidden="true" />
        @if (cart().length > 0) {
          <span class="absolute -top-2 -right-2 w-4 h-4 bg-white text-primary-700 text-[9px]
                        font-extrabold rounded-full flex items-center justify-center leading-none">
            {{ cart().length }}
          </span>
        }
      </div>
    }
  </button>
  `,
})
export class PosComponent implements OnInit {
  private readonly inventoryStore = inject(InventoryStore);
  private readonly ordersStore    = inject(OrdersStore);
  readonly shopStore   = inject(ShopStore);
  private readonly toast   = inject(ToastService);
  private readonly api     = inject(ApiClient);
  private readonly receipt = inject(ReceiptService);
  private readonly cdr     = inject(ChangeDetectorRef);

  @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;

  // Icons
  readonly SearchIcon      = Search;
  readonly CartIcon        = ShoppingCart;
  readonly PlusIcon        = Plus;
  readonly MinusIcon       = Minus;
  readonly Trash2Icon      = Trash2;
  readonly PrinterIcon     = Printer;
  readonly Loader2Icon     = Loader2;
  readonly QrCodeIcon      = QrCode;
  readonly UserIcon        = User;
  readonly ChevronDownIcon = ChevronDown;
  readonly ChevronUpIcon   = ChevronUp;
  readonly BookOpenIcon    = BookOpen;
  readonly CheckIcon       = Check;
  readonly XIcon           = X;

  // â”€â”€ Product search state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  readonly searchQuery    = signal('');
  get isMobile(): boolean { return window.innerWidth < 1024; }

  // â”€â”€ Cart state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  readonly discount        = signal(0);
  readonly activeCategory  = signal('All');
  readonly cart            = signal<CartLine[]>([]);
  readonly paymentMethod   = signal<PaymentMethodType>('CASH');
  readonly checkoutLoading = signal(false);
  readonly customerOpen    = signal(false);
  readonly cartExpanded    = signal(false);
  readonly focusedIdx      = signal(-1);
  readonly addToKhata      = signal(false);

  // â”€â”€ Customer / Khata state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  customer: CustomerInfo                    = { name: '', phone: '', cnic: '' };
  readonly customerSearch  = signal('');
  readonly customerResults = signal<KhataCustomer[]>([]);
  readonly linkedCustomer  = signal<KhataCustomer | null>(null);
  private custSearchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly paymentMethods: { label: string; value: PaymentMethodType }[] = [
    { label: 'Cash',    value: 'CASH' },
    { label: 'Card',    value: 'CARD_KHATA' },
    { label: 'Digital', value: 'DIGITAL_PAY' },
  ];

  // â”€â”€ Derived â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  readonly allCategories = computed(() => {
    const cats = [...new Set(this.inventoryStore.items().map(i => i.category))].sort();
    return ['All', ...cats];
  });

  readonly filteredProducts = computed(() => {
    const q   = this.searchQuery().toLowerCase().trim();
    const cat = this.activeCategory();
    return this.inventoryStore.items().filter(i => {
      const matchCat = cat === 'All' || i.category === cat;
      const matchQ   = !q
        || i.name.toLowerCase().includes(q)
        || i.category.toLowerCase().includes(q)
        || (i.description ?? '').toLowerCase().includes(q)
        || (i.imei  ?? '').includes(q)
        || (i.imei2 ?? '').includes(q)
        || (i.sku   ?? '').toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  });

  readonly subtotal  = computed(() =>
    this.cart().reduce((s, l) => s + this.linePrice(l) * l.qty, 0));
  readonly total     = computed(() => Math.max(0, this.subtotal() - this.discount()));
  readonly qrDataUri = computed(() => this.shopStore.paymentQrDataUri());

  // â”€â”€ Keyboard shortcuts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (e.altKey && e.key === 'k') {
      e.preventDefault();
      if (this.isMobile) this.cartExpanded.set(false);
      this.searchInputRef?.nativeElement.focus();
    }
  }

  onSearchKeydown(e: KeyboardEvent): void {
    const products = this.filteredProducts();
    const len = products.length;
    if (len === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.focusedIdx.set((this.focusedIdx() + 1) % len);
      this.scrollProductIntoView(this.focusedIdx());
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.focusedIdx.set((this.focusedIdx() - 1 + len) % len);
      this.scrollProductIntoView(this.focusedIdx());
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = this.focusedIdx() >= 0 ? products[this.focusedIdx()] : products[0];
      if (item) this.addToCart(item);
    } else if (e.key === 'Escape') {
      this.searchQuery.set('');
      this.focusedIdx.set(-1);
      this.cdr.markForCheck();
    }
  }

  private scrollProductIntoView(idx: number): void {
    setTimeout(() =>
      document.getElementById('prod-' + idx)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0);
  }

  onSearchChange(value: string): void { this.searchQuery.set(value); this.focusedIdx.set(-1); }
  setCategory(cat: string): void      { this.activeCategory.set(cat); this.focusedIdx.set(-1); }

  // â”€â”€ Customer search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  onCustomerSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.customerSearch.set(value);
    this.customer.name = value; // mirror into manual field
    if (this.custSearchTimer) clearTimeout(this.custSearchTimer);
    if (!value.trim()) { this.customerResults.set([]); return; }
    this.custSearchTimer = setTimeout(() => void this.searchCustomers(value), 300);
  }

  private async searchCustomers(q: string): Promise<void> {
    try {
      const data = await this.api.get<{ customers: KhataCustomer[] }>(
        `/api/v1/customers?search=${encodeURIComponent(q)}&status=all`,
      );
      this.customerResults.set(data.customers.slice(0, 5));
      this.cdr.markForCheck();
    } catch { /* silently ignore */ }
  }

  linkCustomer(c: KhataCustomer): void {
    this.linkedCustomer.set(c);
    this.customerSearch.set(c.name);
    this.customer = { name: c.name, phone: c.phone ?? '', cnic: '' };
    this.customerResults.set([]);
  }

  unlinkCustomer(): void {
    this.linkedCustomer.set(null);
    this.customerSearch.set('');
    this.customer = { name: '', phone: '', cnic: '' };
    this.customerResults.set([]);
  }

  // â”€â”€ Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async ngOnInit(): Promise<void> {
    if (!this.shopStore.shopId()) await this.shopStore.load();
    const shopId = this.shopStore.shopId();
    if (shopId && this.inventoryStore.items().length === 0) {
      await this.inventoryStore.load(shopId);
    }
  }

  // â”€â”€ Cart operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  addToCart(item: InventoryItemRow): void {
    if (item.stock === 0) return;
    this.cart.update(lines => {
      const existing = lines.find(l => l.item.id === item.id);
      if (existing) {
        if (existing.qty >= item.stock) { this.toast.warning('No more stock available.'); return lines; }
        return lines.map(l => l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l);
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
      lines.map(l => l.item.id === line.item.id ? { ...l, qty: l.qty + 1 } : l));
  }

  decQty(line: CartLine): void {
    if (line.qty <= 1) { this.removeLine(line); return; }
    this.cart.update(lines =>
      lines.map(l => l.item.id === line.item.id ? { ...l, qty: l.qty - 1 } : l));
  }

  setCustomPrice(line: CartLine, event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    this.cart.update(lines =>
      lines.map(l => l.item.id === line.item.id
        ? { ...l, customPrice: isNaN(val) || val < 0 ? null : val } : l));
  }

  linePrice(line: CartLine): number {
    return line.customPrice !== null ? line.customPrice : line.item.selling_price;
  }

  clearCart(): void {
    this.cart.set([]);
    this.discount.set(0);
    this.customer = { name: '', phone: '', cnic: '' };
    this.customerOpen.set(false);
    this.addToKhata.set(false);
    this.unlinkCustomer();
  }

  private printReceipt(order: {
    order_number: string; created_at: string;
    subtotal: number; discount: number; total: number; payment_method: string;
    customer_name: string | null; customer_phone: string | null; customer_cnic: string | null;
    items: Array<{ name_snapshot: string; description: string | null; qty: number; unit_price: number; line_total: number }>;
  }): void {
    this.receipt.print({
      order_number:   order.order_number,
      created_at:     order.created_at,
      subtotal:       order.subtotal,
      discount:       order.discount,
      total:          order.total,
      payment_method: order.payment_method,
      customer_name:  order.customer_name,
      customer_phone: order.customer_phone,
      customer_cnic:  order.customer_cnic,
      order_items:    order.items,
    });
  }

  // â”€â”€ Checkout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async completeSale(): Promise<void> {
    const lines = this.cart();
    if (lines.length === 0) return;
    this.checkoutLoading.set(true);

    const idempotencyKey = crypto.randomUUID();
    const items = lines.map(l => ({
      inventoryId:  l.item.id,
      qty:          l.qty,
      unitPrice:    this.linePrice(l),
      nameSnapshot: l.item.name,
      description:  l.item.description ?? null,
    }));
    const sub    = this.subtotal();
    const disc   = this.discount();
    // Prefer linked customer, fall back to manual fields
    const linked  = this.linkedCustomer();
    const cName   = linked?.name  ?? (this.customer.name.trim()  || null);
    const cPhone  = linked?.phone ?? (this.customer.phone.trim() || null);
    const cCnic   = this.customer.cnic.trim() || null;
    const shouldKhata = this.addToKhata() && (!!linked || !!cName);

    try {
      const result = await this.api.post<{ order: Record<string, unknown> }>(
        '/api/v1/pos/checkout',
        { items, discount: disc, paymentMethod: this.paymentMethod(),
          idempotencyKey, customerName: cName, customerPhone: cPhone, customerCnic: cCnic },
        idempotencyKey,
      );
      const o = result.order as {
        order_number: string; created_at: string; id: string;
        subtotal: number; discount: number; total: number; payment_method: string;
        channel: string; payment_verified: boolean; idempotency_key: string | null;
        shop_id: string;
        customer_name: string | null; customer_phone: string | null; customer_cnic: string | null;
      };

      // â”€â”€ Khata credit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (shouldKhata) {
        try {
          let customerId = linked?.id ?? null;
          if (!customerId && cPhone) {
            const found = await this.api.get<{ customers: Array<{ id: string }> }>(
              `/api/v1/customers?search=${encodeURIComponent(cPhone)}`,
            );
            customerId = found.customers[0]?.id ?? null;
          }
          if (!customerId && cName) {
            const created = await this.api.post<{ id: string }>(
              '/api/v1/customers',
              { name: cName, phone: cPhone, cnic: cCnic },
            );
            customerId = created.id;
          }
          if (customerId) {
            const orderTotal = Math.max(0, sub - disc);
            await this.api.post(`/api/v1/customers/${customerId}/transactions`, {
              tx_type:  'CREDIT',
              amount:   orderTotal,
              order_id: o.id,
              notes:    `POS order ${o.order_number}`,
            });
            this.toast.success(
              `Khata updated â€” PKR ${orderTotal.toLocaleString('en-PK', { maximumFractionDigits: 0 })} added.`);
          }
        } catch {
          this.toast.warning('Order saved but Khata could not be updated.');
        }
      }

      // â”€â”€ Update local stores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      for (const line of lines) {
        this.inventoryStore.patchItem(line.item.id, { stock: Math.max(0, line.item.stock - line.qty) });
      }
      this.ordersStore.prependOrder({
        id:               o.id ?? crypto.randomUUID(),
        shop_id:          o.shop_id ?? this.shopStore.shopId() ?? '',
        order_number:     o.order_number,
        customer_name:    o.customer_name  ?? cName,
        customer_phone:   o.customer_phone ?? cPhone,
        customer_cnic:    o.customer_cnic  ?? cCnic,
        channel:          (o.channel ?? 'POS') as import('../../core/database.types').OrderChannel,
        payment_method:   (o.payment_method ?? this.paymentMethod()) as import('../../core/database.types').PaymentMethod,
        subtotal:         o.subtotal  ?? sub,
        discount:         o.discount  ?? disc,
        total:            o.total     ?? Math.max(0, sub - disc),
        payment_verified: o.payment_verified ?? false,
        idempotency_key:  o.idempotency_key  ?? idempotencyKey,
        created_at:       o.created_at,
      });

      this.clearCart();
      this.cartExpanded.set(false);
      this.toast.success(`Order ${o.order_number} completed.`);
      this.printReceipt({
        order_number:   o.order_number,
        created_at:     o.created_at,
        subtotal:       o.subtotal ?? sub,
        discount:       o.discount ?? disc,
        total:          o.total    ?? Math.max(0, sub - disc),
        payment_method: o.payment_method ?? this.paymentMethod(),
        customer_name:  o.customer_name ?? cName,
        customer_phone: o.customer_phone ?? cPhone,
        customer_cnic:  o.customer_cnic  ?? cCnic,
        items: items.map(i => ({
          name_snapshot: i.nameSnapshot,
          description:   i.description,
          qty:           i.qty,
          unit_price:    i.unitPrice,
          line_total:    i.qty * i.unitPrice,
        })),
      });
    } catch (err) {
      if (err instanceof ApiError && err.isConflict)
        this.toast.error('Stock changed â€” refresh and retry.');
      else
        this.toast.error('Checkout failed. Please try again.');
    } finally {
      this.checkoutLoading.set(false);
    }
  }
}
