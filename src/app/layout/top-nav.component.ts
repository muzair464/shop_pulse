import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ClipboardList,
  Settings,
  LogOut,
  Zap,
} from 'lucide-angular';
import { AuthService } from '../core/auth.service';
import { ShopStore } from '../core/shop.store';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LucideAngularModule],
  template: `
    <nav class="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">

          <!-- Brand -->
          <div class="flex items-center gap-2">
            <lucide-icon [img]="ZapIcon" size="22" class="text-primary-600" aria-hidden="true" />
            <!-- Note: "TailGrids" branding carried from original design; clean up pre-launch -->
            <span class="text-lg font-bold text-gray-900 tracking-tight">ShopPulse</span>
            @if (shopName()) {
              <span class="hidden sm:inline text-sm text-gray-400 font-normal ml-1">
                · {{ shopName() }}
              </span>
            }
          </div>

          <!-- Primary nav links -->
          <div class="hidden md:flex items-center gap-1">
            @for (link of navLinks; track link.path) {
              <a
                [routerLink]="link.path"
                routerLinkActive="bg-primary-50 text-primary-700 font-semibold"
                [routerLinkActiveOptions]="{ exact: false }"
                class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600
                       hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150"
                [attr.aria-label]="link.label"
              >
                <lucide-icon [img]="link.icon" size="16" aria-hidden="true" />
                {{ link.label }}
              </a>
            }
          </div>

          <!-- Logout button -->
          <button
            type="button"
            (click)="logout()"
            class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500
                   hover:bg-red-50 hover:text-red-600 transition-colors duration-150"
            aria-label="Sign out"
          >
            <lucide-icon [img]="LogOutIcon" size="16" aria-hidden="true" />
            <span class="hidden sm:inline">Sign out</span>
          </button>
        </div>

        <!-- Mobile nav (below the header bar) -->
        <div class="flex md:hidden items-center gap-1 pb-2 overflow-x-auto">
          @for (link of navLinks; track link.path) {
            <a
              [routerLink]="link.path"
              routerLinkActive="bg-primary-50 text-primary-700 font-semibold"
              [routerLinkActiveOptions]="{ exact: false }"
              class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-gray-600
                     hover:bg-gray-100 whitespace-nowrap transition-colors duration-150"
            >
              <lucide-icon [img]="link.icon" size="14" aria-hidden="true" />
              {{ link.label }}
            </a>
          }
        </div>
      </div>
    </nav>
  `,
})
export class TopNavComponent {
  private readonly auth = inject(AuthService);
  private readonly shopStore = inject(ShopStore);

  readonly shopName = this.shopStore.shopName;

  // Expose icons for template
  readonly ZapIcon = Zap;
  readonly LogOutIcon = LogOut;

  readonly navLinks = [
    { path: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
    { path: '/pos',        label: 'POS',         icon: ShoppingCart },
    { path: '/inventory',  label: 'Inventory',   icon: Package },
    { path: '/orders',     label: 'Orders',      icon: ClipboardList },
    { path: '/settings',   label: 'Settings',    icon: Settings },
  ];

  logout(): void {
    void this.auth.signOut();
  }
}
