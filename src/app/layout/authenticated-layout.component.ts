import { Component, OnInit, inject, effect } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { TopNavComponent } from './top-nav.component';
import { ToastContainerComponent } from '../shared/toast-container.component';
import { ShopStore } from '../core/shop.store';
import { RealtimeSyncService } from '../core/realtime-sync.service';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-authenticated-layout',
  standalone: true,
  imports: [RouterOutlet, TopNavComponent, ToastContainerComponent],
  template: `
    <div class="min-h-screen bg-gray-50">
      <app-top-nav />
      <!-- pb-16 on mobile reserves space for the fixed bottom nav tab bar -->
      <main
        class="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 pb-20 md:pb-8"
        [class.pt-4]="!isPosRoute"
        [class.md:pt-8]="!isPosRoute"
        [class.pt-2]="isPosRoute"
        [class.md:pt-4]="isPosRoute"
      >
        <router-outlet />
      </main>
      <app-toast-container />
    </div>
  `,
})
export class AuthenticatedLayoutComponent implements OnInit {
  private readonly auth     = inject(AuthService);
  private readonly shopStore = inject(ShopStore);
  private readonly realtime  = inject(RealtimeSyncService);
  private readonly router    = inject(Router);

  isPosRoute = false;

  constructor() {
    effect(() => {
      const shopId = this.shopStore.shopId();
      if (shopId) this.realtime.start(shopId);
    });

    // Track active route so POS gets tighter top padding
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.isPosRoute = (e as NavigationEnd).urlAfterRedirects.startsWith('/pos');
      });
  }

  async ngOnInit(): Promise<void> {
    await this.shopStore.load();
    this.isPosRoute = this.router.url.startsWith('/pos');
  }
}
