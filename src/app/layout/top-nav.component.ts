import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import {
  LayoutDashboard, ShoppingCart, Package, ClipboardList, Settings, LogOut, Zap, Menu, X,
  BookOpen,
} from 'lucide-angular';
import { AuthService } from '../core/auth.service';
import { ShopStore } from '../core/shop.store';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LucideAngularModule],
  template: `
    <!-- ── Desktop top nav ─────────────────────────────────────────── -->
    <nav class="bg-white border-b border-gray-200/80 sticky top-0 z-40 shadow-[0_1px_0_0_rgb(0_0_0/0.06)]">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-14 items-center justify-between">

          <!-- Brand -->
          <a [routerLink]="'/dashboard'" class="flex items-center min-w-0 group">
            @if (shopName()) {
              <span class="text-lg font-bold text-ink tracking-tight truncate 
                           hover:text-primary-600 transition-colors duration-200">
                {{ shopName() }}
              </span>
            }
          </a>

          <!-- Desktop nav links -->
          <div class="hidden md:flex items-center gap-0.5">
            @for (link of navLinks; track link.path) {
              <a [routerLink]="link.path"
                routerLinkActive="bg-primary-50 text-primary-600 font-semibold"
                [routerLinkActiveOptions]="{ exact: false }"
                class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-500
                       hover:bg-surface-raised hover:text-ink transition-all duration-150 ease-sp whitespace-nowrap"
                [attr.aria-label]="link.label">
                <lucide-icon [img]="link.icon" size="15" aria-hidden="true" />
                {{ link.label }}
              </a>
            }
          </div>

          <!-- Right side: sign out (desktop) -->
          <button type="button" (click)="logout()"
            class="hidden md:flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-400
                   hover:bg-danger-50 hover:text-danger-600 transition-all duration-150 ease-sp shrink-0"
            aria-label="Sign out">
            <lucide-icon [img]="LogOutIcon" size="15" aria-hidden="true" />
            Sign out
          </button>

          <!-- Mobile: sign out icon only -->
          <button type="button" (click)="logout()"
            class="flex md:hidden items-center justify-center w-9 h-9 rounded-lg text-gray-400
                   hover:bg-danger-50 hover:text-danger-600 transition-all duration-150 ease-sp shrink-0"
            aria-label="Sign out">
            <lucide-icon [img]="LogOutIcon" size="16" aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>

    <!-- ── Mobile bottom tab bar ────────────────────────────────────── -->
    <nav class="md:hidden fixed bottom-0 left-0 right-0 z-50
                bg-white border-t border-gray-200/80 flex items-stretch
                shadow-[0_-1px_0_0_rgb(0_0_0/0.06)]"
         aria-label="Main navigation">
      @for (link of navLinks; track link.path) {
        <a [routerLink]="link.path"
          routerLinkActive="text-primary-600"
          [routerLinkActiveOptions]="{ exact: false }"
          class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1
                 text-gray-400 hover:text-ink transition-colors duration-150 ease-sp min-w-0"
          [attr.aria-label]="link.label">
          <lucide-icon [img]="link.icon" size="20" aria-hidden="true" />
          <span class="text-[10px] font-medium leading-none truncate w-full text-center">
            {{ link.label }}
          </span>
        </a>
      }
    </nav>
  `,
})
export class TopNavComponent {
  private readonly auth = inject(AuthService);
  private readonly shopStore = inject(ShopStore);

  readonly shopName = this.shopStore.shopName;
  readonly ZapIcon   = Zap;
  readonly LogOutIcon = LogOut;
  readonly MenuIcon   = Menu;
  readonly XIcon      = X;

  readonly navLinks = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/pos',       label: 'POS',       icon: ShoppingCart },
    { path: '/inventory', label: 'Inventory', icon: Package },
    { path: '/orders',    label: 'Orders',    icon: ClipboardList },
    { path: '/khata',     label: 'Khata',     icon: BookOpen },
    { path: '/settings',  label: 'Settings',  icon: Settings },
  ];

  logout(): void { void this.auth.signOut(); }
}
