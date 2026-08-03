import {
  Component, inject, signal, OnInit, ChangeDetectionStrategy,
} from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Zap, Mail, Loader2, CheckCircle, AlertCircle, RefreshCw, ArrowLeft,
} from 'lucide-angular';
import { AuthService } from '../../core/auth.service';

type PageState =
  | 'waiting'       // just signed up — show "check your inbox"
  | 'verifying'     // token_hash found in URL — exchanging OTP
  | 'done'          // verification succeeded — about to redirect
  | 'error';        // OTP exchange failed (expired / already used)

/**
 * VerifyEmailComponent — /verify-email
 *
 * Two roles in one component:
 *
 *  A) HOLDING SCREEN (no token_hash in URL)
 *     Reached right after signup. Shows the "check your email" message.
 *     Displays the email address passed via ?email= query param.
 *     Offers a "Resend" link (re-calls POST /api/v1/auth/forgot-password
 *     as a best-effort nudge — Supabase does rate-limit this).
 *
 *  B) CALLBACK HANDLER (token_hash + type=email in URL)
 *     Supabase's confirmation email points to:
 *       https://app.shoppulse.app/verify-email?token_hash=XXX&type=email
 *     On mount the component immediately calls POST /api/v1/auth/verify-email,
 *     which exchanges the OTP for a real session cookie, then redirects to
 *     /dashboard.
 */
@Component({
  selector: 'app-verify-email',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule],
  template: `
    <div class="w-full max-w-sm">

      <!-- Brand header -->
      <div class="mb-8 text-center">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl
                    bg-primary-600 mb-4 shadow-lg">
          <lucide-icon [img]="ZapIcon" size="24" class="text-white" aria-hidden="true" />
        </div>
        <h1 class="text-2xl font-bold text-gray-900">ShopPulse</h1>
      </div>

      <!-- ── A: Holding screen ─────────────────────────────────────────── -->
      @if (state() === 'waiting') {
        <div class="card p-8 text-center space-y-5">

          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full
                      bg-blue-50 mx-auto">
            <lucide-icon [img]="MailIcon" size="32" class="text-blue-500" aria-hidden="true" />
          </div>

          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-gray-900">Check your inbox</h2>
            <p class="text-sm text-gray-500">
              We sent a confirmation link to
            </p>
            @if (email()) {
              <p class="text-sm font-semibold text-gray-800 break-all">{{ email() }}</p>
            }
          </div>

          <p class="text-xs text-gray-400 leading-relaxed">
            Click the link in the email to activate your account.
            The link expires in&nbsp;24&nbsp;hours.
          </p>

          <!-- Resend nudge -->
          <div class="pt-2 border-t border-gray-100">
            <p class="text-xs text-gray-400 mb-2">Didn't receive it?</p>
            @if (resendSent()) {
              <p class="text-xs text-green-600 font-medium" role="status">
                Resent! Check your inbox (and spam folder).
              </p>
            } @else if (resendError()) {
              <p class="text-xs text-red-500" role="alert">{{ resendError() }}</p>
            } @else {
              <button type="button" (click)="resend()"
                class="inline-flex items-center gap-1.5 text-xs font-semibold
                       text-primary-600 hover:text-primary-700 hover:underline
                       focus:outline-none focus:underline disabled:opacity-50"
                [disabled]="resending()">
                @if (resending()) {
                  <lucide-icon [img]="Loader2Icon" size="13"
                    class="animate-spin" aria-hidden="true" />
                  Sending…
                } @else {
                  <lucide-icon [img]="RefreshCwIcon" size="13" aria-hidden="true" />
                  Resend confirmation email
                }
              </button>
            }
          </div>

          <a routerLink="/signin"
            class="inline-flex items-center gap-1.5 text-xs text-gray-400
                   hover:text-gray-600 hover:underline focus:outline-none focus:underline">
            <lucide-icon [img]="ArrowLeftIcon" size="12" aria-hidden="true" />
            Back to sign in
          </a>

        </div>
      }

      <!-- ── B: Verifying OTP (spinner) ────────────────────────────────── -->
      @if (state() === 'verifying') {
        <div class="card p-12 flex flex-col items-center gap-4">
          <lucide-icon [img]="Loader2Icon" size="32"
            class="text-primary-500 animate-spin" aria-hidden="true" />
          <div class="text-center">
            <p class="text-sm font-semibold text-gray-800">Verifying your email…</p>
            <p class="text-xs text-gray-400 mt-1">Just a moment</p>
          </div>
        </div>
      }

      <!-- ── B: Verification succeeded ────────────────────────────────── -->
      @if (state() === 'done') {
        <div class="card p-12 flex flex-col items-center gap-4 text-center">
          <lucide-icon [img]="CheckCircleIcon" size="40"
            class="text-green-500" aria-hidden="true" />
          <div>
            <p class="text-sm font-semibold text-gray-800">Email verified!</p>
            <p class="text-xs text-gray-400 mt-1">Redirecting to your dashboard…</p>
          </div>
        </div>
      }

      <!-- ── B: Verification failed ────────────────────────────────────── -->
      @if (state() === 'error') {
        <div class="card p-8 text-center space-y-5">
          <lucide-icon [img]="AlertCircleIcon" size="36"
            class="mx-auto text-red-400" aria-hidden="true" />
          <div class="space-y-1">
            <p class="text-sm font-semibold text-gray-800">Link invalid or expired</p>
            <p class="text-xs text-gray-500">{{ errorMessage() }}</p>
          </div>
          <p class="text-xs text-gray-400">
            Confirmation links expire after 24 hours and can only be used once.
          </p>
          <div class="flex flex-col gap-2">
            <a routerLink="/signup"
              class="btn-primary w-full justify-center text-sm">
              Create a new account
            </a>
            <a routerLink="/signin"
              class="btn-secondary w-full justify-center text-sm">
              Back to sign in
            </a>
          </div>
        </div>
      }

    </div>
  `,
})
export class VerifyEmailComponent implements OnInit {
  private readonly auth  = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly ZapIcon         = Zap;
  readonly MailIcon        = Mail;
  readonly Loader2Icon     = Loader2;
  readonly CheckCircleIcon = CheckCircle;
  readonly AlertCircleIcon = AlertCircle;
  readonly RefreshCwIcon   = RefreshCw;
  readonly ArrowLeftIcon   = ArrowLeft;

  readonly state        = signal<PageState>('waiting');
  readonly email        = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly resending    = signal(false);
  readonly resendSent   = signal(false);
  readonly resendError  = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const params    = this.route.snapshot.queryParamMap;
    const tokenHash = params.get('token_hash');
    const type      = params.get('type');
    const emailParam = params.get('email');

    // Store email for the holding screen display.
    if (emailParam) this.email.set(emailParam);

    // ── Role B: OTP callback ──────────────────────────────────────────────
    if (tokenHash && type === 'email') {
      this.state.set('verifying');

      const { error } = await this.auth.verifyEmail(tokenHash);

      if (error) {
        this.errorMessage.set(error);
        this.state.set('error');
        return;
      }

      this.state.set('done');
      // Short pause so the success state is visible, then go to dashboard.
      setTimeout(() => {
        void this.router.navigate(['/dashboard'], { replaceUrl: true });
      }, 1_500);
      return;
    }

    // ── Role A: Holding screen ────────────────────────────────────────────
    // No token in URL — user was just redirected here after signup.
    this.state.set('waiting');
  }

  /** Resend the signup confirmation email (not a password reset). */
  async resend(): Promise<void> {
    const addr = this.email();
    if (!addr) return;

    this.resending.set(true);
    this.resendError.set(null);

    const { error } = await this.auth.resendVerification(addr);

    this.resending.set(false);

    if (error) {
      this.resendError.set(error);
    } else {
      this.resendSent.set(true);
    }
  }
}
