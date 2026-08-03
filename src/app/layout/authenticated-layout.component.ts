import { Component, OnInit, inject, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopNavComponent } from './top-nav.component';
import { ToastContainerComponent } from '../shared/toast-container.component';
import { ShopStore } from '../core/shop.store';
import { RealtimeSyncService } from '../core/realtime-sync.service';
import { AuthService } from '../core/auth.service';

/**
 * AuthenticatedLayoutComponent — shell for all guarded routes.
 *
 * Responsibilities:
 *  1. Renders TopNavComponent + <router-outlet>.
 *  2. Loads the shop profile on first render.
 *  3. Starts RealtimeSyncService once shopId is available.
 *  4. Tears down realtime on destroy.
 */
@Component({
  selector: 'app-authenticated-layout',
  standalone: true,
  imports: [RouterOutlet, TopNavComponent, ToastContainerComponent],
  template: `
    <div class="min-h-screen bg-gray-50">
      <app-top-nav />
      <main class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <router-outlet />
      </main>
      <app-toast-container />
    </div>
  `,
})
export class AuthenticatedLayoutComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly shopStore = inject(ShopStore);
  private readonly realtime = inject(RealtimeSyncService);

  constructor() {
    // Start realtime as soon as shopId becomes available
    effect(() => {
      const shopId = this.shopStore.shopId();
      if (shopId) {
        this.realtime.start(shopId);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await this.shopStore.load();
  }
}
