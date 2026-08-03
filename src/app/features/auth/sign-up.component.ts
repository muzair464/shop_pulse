import {
  Component, inject, signal, computed, ChangeDetectionStrategy,
} from '@angular/core';
import {
  FormBuilder, Validators, AbstractControl, ValidationErrors, ReactiveFormsModule,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Eye, EyeOff, Zap, Loader2, ArrowRight, ArrowLeft,
  User, Store, Phone, MapPin, Mail, Lock,
} from 'lucide-angular';
import { AuthService } from '../../core/auth.service';
import { ApiError } from '../../core/api.client';

/** Cross-field validator — passwords must match. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pw  = group.get('password')?.value  as string;
  const cpw = group.get('confirm')?.value as string;
  return pw && cpw && pw !== cpw ? { mismatch: true } : null;
}

/**
 * SignUpComponent — /signup
 *
 * Two-step registration:
 *  Step 1 — Account: email, password, confirm password
 *  Step 2 — Shop:    shop name (required), phone (optional), address (optional)
 *
 * On submit → POST /api/v1/auth/signup
 * On success → navigate to /verify-email (holding screen with "check your inbox")
 */
@Component({
  selector: 'app-sign-up',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule],
  template: `
    <div class="w-full max-w-sm">

      <!-- ── Brand header ──────────────────────────────────────────────── -->
      <div class="mb-8 text-center">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl
                    bg-primary-600 mb-4 shadow-lg">
          <lucide-icon [img]="ZapIcon" size="24" class="text-white" aria-hidden="true" />
        </div>
        <h1 class="text-2xl font-bold text-gray-900">ShopPulse</h1>
        <p class="mt-1 text-sm text-gray-500">Create your account</p>
      </div>

      <!-- ── Step indicator ────────────────────────────────────────────── -->
      <div class="flex items-center gap-2 mb-6" aria-label="Registration steps">
        <div class="flex items-center gap-1.5">
          <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                      transition-colors"
               [class]="step() >= 1
                 ? 'bg-primary-600 text-white'
                 : 'bg-gray-200 text-gray-500'">
            1
          </div>
          <span class="text-xs font-medium"
                [class]="step() >= 1 ? 'text-primary-700' : 'text-gray-400'">
            Account
          </span>
        </div>
        <div class="flex-1 h-px" [class]="step() >= 2 ? 'bg-primary-400' : 'bg-gray-200'"></div>
        <div class="flex items-center gap-1.5">
          <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                      transition-colors"
               [class]="step() >= 2
                 ? 'bg-primary-600 text-white'
                 : 'bg-gray-200 text-gray-500'">
            2
          </div>
          <span class="text-xs font-medium"
                [class]="step() >= 2 ? 'text-primary-700' : 'text-gray-400'">
            Shop
          </span>
        </div>
      </div>

      <!-- ── Step 1: Account details ───────────────────────────────────── -->
      @if (step() === 1) {
        <div class="card p-8">
          <form [formGroup]="accountForm" (ngSubmit)="nextStep()" novalidate class="space-y-4">

            <!-- Email -->
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700 mb-1.5">
                <span class="inline-flex items-center gap-1.5">
                  <lucide-icon [img]="MailIcon" size="13" class="text-gray-400" aria-hidden="true" />
                  Email address <span class="text-red-500" aria-hidden="true">*</span>
                </span>
              </label>
              <input id="email" type="email" formControlName="email"
                autocomplete="email" class="form-input"
                [class.border-red-400]="f1['email'].invalid && f1['email'].touched"
                placeholder="you@example.com"
                aria-required="true"
                [attr.aria-invalid]="f1['email'].invalid && f1['email'].touched"
                aria-describedby="email-error" />
              @if (f1['email'].invalid && f1['email'].touched) {
                <p id="email-error" class="mt-1 text-xs text-red-600" role="alert">
                  Please enter a valid email address.
                </p>
              }
            </div>

            <!-- Password -->
            <div>
              <label for="password" class="block text-sm font-medium text-gray-700 mb-1.5">
                <span class="inline-flex items-center gap-1.5">
                  <lucide-icon [img]="LockIcon" size="13" class="text-gray-400" aria-hidden="true" />
                  Password <span class="text-red-500" aria-hidden="true">*</span>
                </span>
              </label>
              <div class="relative">
                <input id="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  autocomplete="new-password"
                  class="form-input pr-10"
                  [class.border-red-400]="f1['password'].invalid && f1['password'].touched"
                  placeholder="At least 8 characters"
                  aria-required="true"
                  [attr.aria-invalid]="f1['password'].invalid && f1['password'].touched"
                  aria-describedby="password-error" />
                <button type="button" (click)="togglePassword()"
                  class="absolute inset-y-0 right-0 flex items-center pr-3
                         text-gray-400 hover:text-gray-600"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
                  <lucide-icon [img]="showPassword() ? EyeOffIcon : EyeIcon"
                    size="16" aria-hidden="true" />
                </button>
              </div>
              @if (f1['password'].invalid && f1['password'].touched) {
                <p id="password-error" class="mt-1 text-xs text-red-600" role="alert">
                  Password must be at least 8 characters.
                </p>
              }
              <!-- Strength bar -->
              <div class="flex gap-1 mt-2" aria-label="Password strength">
                @for (seg of strengthSegments(); track $index) {
                  <div class="flex-1 h-1 rounded-full transition-colors" [class]="seg"></div>
                }
              </div>
            </div>

            <!-- Confirm password -->
            <div>
              <label for="confirm" class="block text-sm font-medium text-gray-700 mb-1.5">
                <span class="inline-flex items-center gap-1.5">
                  <lucide-icon [img]="LockIcon" size="13" class="text-gray-400" aria-hidden="true" />
                  Confirm password <span class="text-red-500" aria-hidden="true">*</span>
                </span>
              </label>
              <input id="confirm"
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="confirm"
                autocomplete="new-password"
                class="form-input"
                [class.border-red-400]="confirmInvalid"
                placeholder="Repeat your password"
                aria-required="true"
                [attr.aria-invalid]="confirmInvalid"
                aria-describedby="confirm-error" />
              @if (confirmInvalid) {
                <p id="confirm-error" class="mt-1 text-xs text-red-600" role="alert">
                  Passwords do not match.
                </p>
              }
            </div>

            <button type="submit"
              class="btn-primary w-full justify-center mt-2">
              Continue
              <lucide-icon [img]="ArrowRightIcon" size="15" aria-hidden="true" />
            </button>

          </form>
        </div>
      }

      <!-- ── Step 2: Shop details ───────────────────────────────────────── -->
      @if (step() === 2) {
        <div class="card p-8">
          <form [formGroup]="shopForm" (ngSubmit)="submit()" novalidate class="space-y-4">

            <!-- Shop name -->
            <div>
              <label for="shopName" class="block text-sm font-medium text-gray-700 mb-1.5">
                <span class="inline-flex items-center gap-1.5">
                  <lucide-icon [img]="StoreIcon" size="13" class="text-gray-400" aria-hidden="true" />
                  Shop name <span class="text-red-500" aria-hidden="true">*</span>
                </span>
              </label>
              <input id="shopName" type="text" formControlName="shopName"
                autocomplete="organization" class="form-input"
                [class.border-red-400]="f2['shopName'].invalid && f2['shopName'].touched"
                placeholder="e.g. Galaxy Mobiles"
                aria-required="true"
                [attr.aria-invalid]="f2['shopName'].invalid && f2['shopName'].touched"
                aria-describedby="shopName-error" />
              @if (f2['shopName'].invalid && f2['shopName'].touched) {
                <p id="shopName-error" class="mt-1 text-xs text-red-600" role="alert">
                  Shop name is required.
                </p>
              }
            </div>

            <!-- Phone (optional) -->
            <div>
              <label for="phone" class="block text-sm font-medium text-gray-700 mb-1.5">
                <span class="inline-flex items-center gap-1.5">
                  <lucide-icon [img]="PhoneIcon" size="13" class="text-gray-400" aria-hidden="true" />
                  Phone
                  <span class="text-xs font-normal text-gray-400">(optional)</span>
                </span>
              </label>
              <input id="phone" type="tel" formControlName="phone"
                autocomplete="tel" class="form-input"
                placeholder="+92 300 0000000" />
            </div>

            <!-- Address (optional) -->
            <div>
              <label for="address" class="block text-sm font-medium text-gray-700 mb-1.5">
                <span class="inline-flex items-center gap-1.5">
                  <lucide-icon [img]="MapPinIcon" size="13" class="text-gray-400" aria-hidden="true" />
                  Address
                  <span class="text-xs font-normal text-gray-400">(optional)</span>
                </span>
              </label>
              <textarea id="address" formControlName="address"
                rows="2" class="form-input resize-none"
                placeholder="Shop address"></textarea>
            </div>

            @if (serverError()) {
              <div class="rounded-lg bg-red-50 border border-red-200 px-4 py-3
                          text-sm text-red-700" role="alert" aria-live="polite">
                {{ serverError() }}
              </div>
            }

            <div class="flex gap-3 mt-2">
              <button type="button" (click)="prevStep()"
                class="btn-secondary flex-1 justify-center"
                [disabled]="loading()">
                <lucide-icon [img]="ArrowLeftIcon" size="15" aria-hidden="true" />
                Back
              </button>
              <button type="submit"
                class="btn-primary flex-1 justify-center"
                [disabled]="loading()"
                [attr.aria-busy]="loading()">
                @if (loading()) {
                  <lucide-icon [img]="Loader2Icon" size="15"
                    class="animate-spin" aria-hidden="true" />
                  Creating…
                } @else {
                  Create account
                }
              </button>
            </div>

          </form>
        </div>
      }

      <!-- ── Footer: link back to sign in ─────────────────────────────── -->
      <p class="mt-6 text-center text-sm text-gray-500">
        Already have an account?
        <a routerLink="/signin"
          class="font-semibold text-primary-600 hover:text-primary-700 hover:underline
                 focus:outline-none focus:underline ml-1">
          Sign in
        </a>
      </p>

    </div>
  `,
})
export class SignUpComponent {
  private readonly fb     = inject(FormBuilder);
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  readonly ZapIcon       = Zap;
  readonly EyeIcon       = Eye;
  readonly EyeOffIcon    = EyeOff;
  readonly Loader2Icon   = Loader2;
  readonly ArrowRightIcon = ArrowRight;
  readonly ArrowLeftIcon  = ArrowLeft;
  readonly MailIcon      = Mail;
  readonly LockIcon      = Lock;
  readonly StoreIcon     = Store;
  readonly PhoneIcon     = Phone;
  readonly MapPinIcon    = MapPin;
  readonly UserIcon      = User;

  readonly step         = signal<1 | 2>(1);
  readonly loading      = signal(false);
  readonly serverError  = signal<string | null>(null);
  readonly showPassword = signal(false);

  // ── Step 1 form ───────────────────────────────────────────────────────────
  readonly accountForm = this.fb.nonNullable.group(
    {
      email:    ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm:  ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  // ── Step 2 form ───────────────────────────────────────────────────────────
  readonly shopForm = this.fb.nonNullable.group({
    shopName: ['', [Validators.required, Validators.minLength(1)]],
    phone:    [''],
    address:  [''],
  });

  // ── Convenience getters ───────────────────────────────────────────────────
  get f1() { return this.accountForm.controls; }
  get f2() { return this.shopForm.controls; }

  get confirmInvalid(): boolean {
    return this.accountForm.touched
      && !!this.accountForm.errors?.['mismatch']
      && !!this.f1['confirm'].value;
  }

  /** 4-segment password-strength bar. */
  readonly strengthSegments = computed(() => {
    const pw        = this.f1['password'].value as string;
    const hasUpper  = /[A-Z]/.test(pw);
    const hasDigit  = /\d/.test(pw);
    const hasSpec   = /[^A-Za-z0-9]/.test(pw);
    const score     = (pw.length >= 8 ? 1 : 0) + (hasUpper ? 1 : 0)
                    + (hasDigit ? 1 : 0) + (hasSpec ? 1 : 0);
    const fill = ['bg-gray-200', 'bg-red-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'];
    return [0, 1, 2, 3].map(i => (i < score ? fill[score] : 'bg-gray-200'));
  });

  togglePassword(): void { this.showPassword.update(v => !v); }

  // ── Navigation ────────────────────────────────────────────────────────────

  nextStep(): void {
    this.accountForm.markAllAsTouched();
    if (this.accountForm.invalid) return;
    this.serverError.set(null);
    this.step.set(2);
  }

  prevStep(): void {
    this.serverError.set(null);
    this.step.set(1);
  }

  // ── Final submit ──────────────────────────────────────────────────────────

  async submit(): Promise<void> {
    this.shopForm.markAllAsTouched();
    if (this.shopForm.invalid) return;

    this.loading.set(true);
    this.serverError.set(null);

    const { email, password }          = this.accountForm.getRawValue();
    const { shopName, phone, address } = this.shopForm.getRawValue();

    const { error } = await this.auth.signUp({
      email,
      password,
      shopName,
      phone:   phone   || undefined,
      address: address || undefined,
    });

    this.loading.set(false);

    if (error) {
      this.serverError.set(error);
      return;
    }

    // Navigate to the "check your inbox" holding screen, carrying the email
    // so it can be shown to the user.
    void this.router.navigate(['/verify-email'], {
      queryParams:  { email },
      replaceUrl:   true,
    });
  }
}
