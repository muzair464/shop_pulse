import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule, Plus, Pencil, Trash2, X, Loader2 } from 'lucide-angular';
import { InventoryStore } from '../../core/inventory.store';
import { ShopStore } from '../../core/shop.store';
import { ToastService } from '../../core/toast.service';
import { ApiClient, ApiError } from '../../core/api.client';
import { ShopStatsBarComponent } from '../../shared/shop-stats-bar.component';
import { BadgeComponent } from '../../shared/badge.component';
import { PaginationComponent } from '../../shared/pagination.component';
import { ExportCsvButtonComponent } from '../../shared/export-csv-button.component';
import type { InventoryItemRow } from '../../core/database.types';

type TabFilter = 'all' | 'NEW' | 'USED';

@Component({
  selector: 'app-inventory',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, LucideAngularModule, DecimalPipe,
    ShopStatsBarComponent, BadgeComponent, PaginationComponent, ExportCsvButtonComponent,
  ],
  template: `
    <div>
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Inventory</h1>
          <p class="mt-0.5 text-sm text-gray-500">Manage your stock</p>
        </div>
        <div class="flex items-center gap-2">
          <app-export-csv-button apiPath="/api/v1/inventory/export" label="Export CSV" />
          <button type="button" (click)="openAddModal()" class="btn-primary">
            <lucide-icon [img]="PlusIcon" size="15" aria-hidden="true" />
            Add Item
          </button>
        </div>
      </div>

      <app-shop-stats-bar />

      <!-- Tab filter -->
      <div class="flex gap-1 mb-4" role="tablist" aria-label="Filter by classification">
        @for (tab of tabs; track tab.value) {
          <button
            type="button" role="tab"
            (click)="activeTab.set(tab.value)"
            [attr.aria-selected]="activeTab() === tab.value"
            [class.bg-primary-600]="activeTab() === tab.value"
            [class.text-white]="activeTab() === tab.value"
            [class.border-primary-600]="activeTab() === tab.value"
            class="px-4 py-1.5 text-sm font-medium rounded-lg border border-gray-200
                   text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {{ tab.label }}
            <span class="ml-1.5 text-xs opacity-70">({{ tab.count() }})</span>
          </button>
        }
      </div>

      <!-- Table -->
      <div class="overflow-hidden rounded-lg border border-gray-200 bg-white mb-4">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @if (inventoryStore.loading()) {
                @for (i of [1,2,3,4,5]; track i) {
                  <tr class="animate-pulse">
                    @for (j of [1,2,3,4,5,6,7]; track j) {
                      <td class="px-4 py-3"><div class="h-4 bg-gray-200 rounded w-3/4"></div></td>
                    }
                  </tr>
                }
              } @else if (pagedItems().length === 0) {
                <tr>
                  <td colspan="7" class="px-4 py-12 text-center text-sm text-gray-400">
                    No inventory items found.
                  </td>
                </tr>
              } @else {
                @for (item of pagedItems(); track item.id) {
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3">
                      <div class="font-medium text-sm text-gray-900">{{ item.name }}</div>
                      @if (item.imei) {
                        <div class="text-xs text-gray-400 font-mono mt-0.5">{{ item.imei }}</div>
                      }
                      @if (item.sku) {
                        <div class="text-xs text-gray-400 mt-0.5">SKU: {{ item.sku }}</div>
                      }
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-600">{{ item.category }}</td>
                    <td class="px-4 py-3">
                      <app-badge [variant]="item.classification === 'NEW' ? 'blue' : 'yellow'">
                        {{ item.classification === 'NEW' ? 'Brand New' : 'Pre-Owned' }}
                      </app-badge>
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2">
                        <span
                          class="text-sm font-semibold tabular-nums"
                          [class.text-red-600]="item.stock === 0"
                          [class.text-yellow-600]="item.stock > 0 && item.stock <= 5"
                          [class.text-gray-900]="item.stock > 5"
                        >{{ item.stock }}</span>
                        <div class="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            class="h-full rounded-full transition-all"
                            [class.bg-red-500]="item.stock === 0"
                            [class.bg-yellow-400]="item.stock > 0 && item.stock <= 5"
                            [class.bg-green-500]="item.stock > 5"
                            [style.width]="stockBarWidth(item.stock) + '%'"
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-600 tabular-nums">
                      {{ item.cost_price | number:'1.0-0' }}
                    </td>
                    <td class="px-4 py-3 text-sm font-medium text-gray-900 tabular-nums">
                      {{ item.selling_price | number:'1.0-0' }}
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-1">
                        <button type="button" (click)="openEditModal(item)"
                          class="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                          aria-label="Edit item">
                          <lucide-icon [img]="PencilIcon" size="14" aria-hidden="true" />
                        </button>
                        <button type="button" (click)="deleteItem(item)"
                          class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          aria-label="Delete item">
                          <lucide-icon [img]="Trash2Icon" size="14" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>

      <app-pagination
        [totalItems]="filteredItems().length"
        [pageSize]="pageSize"
        [currentPage]="currentPage()"
        (pageChange)="currentPage.set($event)"
      />
    </div>

    <!-- Add / Edit Modal -->
    @if (modalOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        role="dialog" aria-modal="true"
        [attr.aria-label]="editingItem() ? 'Edit inventory item' : 'Add inventory item'"
        (click)="closeModal()"
      >
        <div
          class="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 class="text-base font-semibold text-gray-900">
              {{ editingItem() ? 'Edit Item' : 'Add Inventory Item' }}
            </h2>
            <button type="button" (click)="closeModal()"
              class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              aria-label="Close modal">
              <lucide-icon [img]="XIcon" size="16" aria-hidden="true" />
            </button>
          </div>

          <form [formGroup]="itemForm" (ngSubmit)="saveItem()" class="p-6 space-y-4">
            @if (!editingItem()) {
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Item Type</label>
                <div class="flex gap-2">
                  @for (opt of classificationOptions; track opt.value) {
                    <button type="button"
                      (click)="itemForm.controls.classification.setValue(opt.value)"
                      [class.bg-primary-600]="itemForm.controls.classification.value === opt.value"
                      [class.text-white]="itemForm.controls.classification.value === opt.value"
                      [class.border-primary-600]="itemForm.controls.classification.value === opt.value"
                      class="flex-1 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
                      {{ opt.label }}
                    </button>
                  }
                </div>
              </div>
            }

            <div>
              <label for="item-name" class="block text-sm font-medium text-gray-700 mb-1.5">
                Name <span class="text-red-500" aria-hidden="true">*</span>
              </label>
              <input id="item-name" type="text" formControlName="name"
                class="form-input" placeholder="e.g. iPhone 13 Pro 128GB" />
            </div>
            <div>
              <label for="item-desc" class="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea id="item-desc" formControlName="description" rows="2"
                class="form-input resize-none" placeholder="Optional description"></textarea>
            </div>
            <div>
              <label for="item-cat" class="block text-sm font-medium text-gray-700 mb-1.5">
                Category <span class="text-red-500" aria-hidden="true">*</span>
              </label>
              <input id="item-cat" type="text" formControlName="category"
                class="form-input" placeholder="e.g. Smartphones" list="categories" />
              <datalist id="categories">
                @for (cat of categories; track cat) { <option [value]="cat">{{ cat }}</option> }
              </datalist>
            </div>
            <div>
              <label for="item-stock" class="block text-sm font-medium text-gray-700 mb-1.5">
                Stock Quantity <span class="text-red-500" aria-hidden="true">*</span>
              </label>
              <input id="item-stock" type="number" formControlName="stock" min="0"
                class="form-input tabular-nums" placeholder="0" />
            </div>
            @if (itemForm.controls.classification.value === 'USED') {
              <div>
                <label for="item-imei" class="block text-sm font-medium text-gray-700 mb-1.5">IMEI</label>
                <input id="item-imei" type="text" formControlName="imei"
                  class="form-input font-mono" placeholder="15-digit IMEI" maxlength="15" />
              </div>
            }
            <div>
              <label for="item-sku" class="block text-sm font-medium text-gray-700 mb-1.5">SKU</label>
              <input id="item-sku" type="text" formControlName="sku"
                class="form-input" placeholder="Optional SKU code" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="item-cost" class="block text-sm font-medium text-gray-700 mb-1.5">
                  Cost Price <span class="text-red-500" aria-hidden="true">*</span>
                </label>
                <input id="item-cost" type="number" formControlName="cost_price" min="0" step="1"
                  class="form-input tabular-nums" placeholder="0" />
              </div>
              <div>
                <label for="item-price" class="block text-sm font-medium text-gray-700 mb-1.5">
                  Selling Price <span class="text-red-500" aria-hidden="true">*</span>
                </label>
                <input id="item-price" type="number" formControlName="selling_price" min="0" step="1"
                  class="form-input tabular-nums" placeholder="0" />
              </div>
            </div>

            @if (formError()) {
              <p class="text-sm text-red-600" role="alert">{{ formError() }}</p>
            }

            <div class="flex justify-end gap-2 pt-2">
              <button type="button" (click)="closeModal()" class="btn-secondary">Cancel</button>
              <button type="submit" class="btn-primary" [disabled]="formSaving()">
                @if (formSaving()) {
                  <lucide-icon [img]="Loader2Icon" size="15" class="animate-spin" aria-hidden="true" />
                }
                {{ editingItem() ? 'Save Changes' : 'Add Item' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class InventoryComponent implements OnInit {
  readonly inventoryStore = inject(InventoryStore);
  private readonly shopStore = inject(ShopStore);
  private readonly toast  = inject(ToastService);
  private readonly api    = inject(ApiClient);
  private readonly fb     = inject(FormBuilder);

  readonly PlusIcon    = Plus;
  readonly PencilIcon  = Pencil;
  readonly Trash2Icon  = Trash2;
  readonly XIcon       = X;
  readonly Loader2Icon = Loader2;

  readonly activeTab   = signal<TabFilter>('all');
  readonly currentPage = signal(0);
  readonly pageSize    = 20;
  readonly modalOpen   = signal(false);
  readonly editingItem = signal<InventoryItemRow | null>(null);
  readonly formError   = signal<string | null>(null);
  readonly formSaving  = signal(false);

  readonly categories = ['Smartphones', 'Accessories', 'Tablets', 'Laptops', 'Other'];
  readonly classificationOptions = [
    { value: 'NEW'  as const, label: 'Brand New (Bulk)' },
    { value: 'USED' as const, label: 'Pre-Owned (Serialized)' },
  ];

  readonly tabs = [
    { value: 'all'  as TabFilter, label: 'All',       count: computed(() => this.inventoryStore.items().length) },
    { value: 'NEW'  as TabFilter, label: 'Brand New',  count: computed(() => this.inventoryStore.items().filter(i => i.classification === 'NEW').length) },
    { value: 'USED' as TabFilter, label: 'Pre-Owned',  count: computed(() => this.inventoryStore.items().filter(i => i.classification === 'USED').length) },
  ];

  readonly filteredItems = computed(() => {
    const tab = this.activeTab();
    return tab === 'all'
      ? this.inventoryStore.items()
      : this.inventoryStore.items().filter(i => i.classification === tab);
  });

  readonly pagedItems = computed(() => {
    const start = this.currentPage() * this.pageSize;
    return this.filteredItems().slice(start, start + this.pageSize);
  });

  readonly itemForm = this.fb.nonNullable.group({
    classification: ['NEW' as 'NEW' | 'USED'],
    name:           ['', Validators.required],
    description:    [''],
    category:       ['', Validators.required],
    stock:          [0, [Validators.required, Validators.min(0)]],
    imei:           [''],
    sku:            [''],
    cost_price:     [0, [Validators.required, Validators.min(0)]],
    selling_price:  [0, [Validators.required, Validators.min(0)]],
  });

  async ngOnInit(): Promise<void> {
    if (!this.shopStore.shopId()) await this.shopStore.load();
    const shopId = this.shopStore.shopId();
    if (shopId && this.inventoryStore.items().length === 0) {
      await this.inventoryStore.load(shopId);
    }
  }

  openAddModal(): void {
    this.editingItem.set(null);
    this.itemForm.reset({ classification: 'NEW', stock: 0, cost_price: 0, selling_price: 0 });
    this.formError.set(null);
    this.modalOpen.set(true);
  }

  openEditModal(item: InventoryItemRow): void {
    this.editingItem.set(item);
    this.itemForm.patchValue({
      classification: item.classification,
      name: item.name, description: item.description ?? '',
      category: item.category, stock: item.stock,
      imei: item.imei ?? '', sku: item.sku ?? '',
      cost_price: item.cost_price, selling_price: item.selling_price,
    });
    this.formError.set(null);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.editingItem.set(null);
  }

  async saveItem(): Promise<void> {
    if (this.itemForm.invalid) { this.itemForm.markAllAsTouched(); return; }

    const shopId = this.shopStore.shopId();
    if (!shopId) { this.formError.set('Shop not loaded yet.'); return; }

    const val = this.itemForm.getRawValue();
    this.formSaving.set(true);
    this.formError.set(null);

    const editing = this.editingItem();

    try {
      if (editing) {
        // Optimistic update
        const original = { ...editing };
        this.inventoryStore.patchItem(editing.id, {
          name: val.name, description: val.description || null,
          category: val.category, stock: Number(val.stock),
          sku: val.sku || null, cost_price: Number(val.cost_price),
          selling_price: Number(val.selling_price),
        });

        const updated = await this.api.patch<InventoryItemRow>(`/api/v1/inventory/${editing.id}`, {
          name: val.name, description: val.description || null,
          category: val.category, stock: Number(val.stock),
          sku: val.sku || null, cost_price: Number(val.cost_price),
          selling_price: Number(val.selling_price),
          version: editing.version,
        });
        this.inventoryStore.upsertItem(updated);
        this.toast.success('Item updated.');
      } else {
        const inserted = await this.api.post<InventoryItemRow>('/api/v1/inventory', {
          classification: val.classification, name: val.name,
          description: val.description || null, category: val.category,
          stock: Number(val.stock), imei: val.imei || null,
          sku: val.sku || null, cost_price: Number(val.cost_price),
          selling_price: Number(val.selling_price),
        });
        this.inventoryStore.upsertItem(inserted);
        this.toast.success('Item added.');
      }
      this.closeModal();
    } catch (err) {
      if (editing) {
        // Roll back optimistic update
        this.inventoryStore.patchItem(editing.id, editing);
      }
      const msg = err instanceof ApiError ? err.message : 'Save failed.';
      this.formError.set(
        err instanceof ApiError && err.isConflict
          ? 'This item was modified on another device. Please refresh and try again.'
          : msg,
      );
    } finally {
      this.formSaving.set(false);
    }
  }

  async deleteItem(item: InventoryItemRow): Promise<void> {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      await this.api.delete(`/api/v1/inventory/${item.id}`);
      this.inventoryStore.removeItem(item.id);
      this.toast.success('Item deleted.');
    } catch (err) {
      this.toast.error('Failed to delete item: ' + (err instanceof Error ? err.message : ''));
    }
  }

  stockBarWidth(stock: number): number {
    return Math.min(100, (stock / 20) * 100);
  }
}
