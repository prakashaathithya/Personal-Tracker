import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { LogoComponent } from '../shared/logo.component';

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink, LogoComponent],
  template: `
    <div class="auth-wrap">
      <div class="glow glow-mint"></div>
      <div class="glow glow-blue"></div>
      <div class="auth-card">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">
            <app-logo [size]="22" [mono]="true" />
          </span>
          <span class="brand-name">MoneyMap</span>
        </div>

        @if (done()) {
          <div class="headline">
            <h1>Check your email</h1>
            <p class="subhead">
              Account created! Confirm your address from the email we sent, then sign in.
            </p>
          </div>
          <a class="submit link-btn" routerLink="/login">Go to sign in</a>
        } @else {
          <div class="headline">
            <h1>Create your account</h1>
            <p class="subhead">Start tracking your finances</p>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()">
            <label class="field">
              <span class="eyebrow">Full name</span>
              <input type="text" formControlName="fullName" autocomplete="name" placeholder="Jane Doe" />
            </label>
            <label class="field">
              <span class="eyebrow">Email</span>
              <input type="email" formControlName="email" autocomplete="email" placeholder="you@example.com" />
            </label>
            <label class="field">
              <span class="eyebrow">Password</span>
              <input type="password" formControlName="password" autocomplete="new-password" placeholder="At least 6 characters" />
            </label>
            @if (error()) {
              <p class="error">{{ error() }}</p>
            }
            <button class="submit" type="submit" [disabled]="loading() || form.invalid">
              {{ loading() ? 'Creating account…' : 'Sign up' }}
            </button>
          </form>

          <p class="footer">Already have an account? <a routerLink="/login">Sign in</a></p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        --mint: oklch(0.72 0.16 155);
        --mint-bright: oklch(0.78 0.17 155);
      }
      .auth-wrap {
        position: relative;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        overflow: hidden;
        background: oklch(0.16 0.01 240);
        font-family: 'Inter', sans-serif;
      }
      .glow {
        position: absolute;
        border-radius: 50%;
        filter: blur(40px);
        pointer-events: none;
      }
      .glow-mint {
        top: -160px;
        left: -160px;
        width: 460px;
        height: 460px;
        background: radial-gradient(circle, oklch(0.72 0.16 155 / 0.4) 0%, transparent 70%);
      }
      .glow-blue {
        bottom: -160px;
        right: -160px;
        width: 440px;
        height: 440px;
        background: radial-gradient(circle, oklch(0.55 0.1 230 / 0.32) 0%, transparent 70%);
      }
      .auth-card {
        position: relative;
        z-index: 1;
        width: 100%;
        max-width: 420px;
        display: flex;
        flex-direction: column;
        gap: 28px;
        padding: 40px 32px 32px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.045);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.09);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .brand-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 11px;
        background: linear-gradient(135deg, oklch(0.78 0.17 155), oklch(0.62 0.15 165));
        box-shadow: 0 6px 16px -4px oklch(0.72 0.16 155 / 0.5);
      }
      .brand-name {
        font-size: 18px;
        font-weight: 800;
        color: #f2f4f2;
        letter-spacing: -0.01em;
      }
      .headline {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .headline h1 {
        margin: 0;
        font-size: 30px;
        font-weight: 800;
        color: #f6f8f6;
        letter-spacing: -0.02em;
        line-height: 1.1;
      }
      .subhead {
        margin: 0;
        font-size: 14px;
        font-weight: 500;
        color: rgba(240, 245, 240, 0.5);
      }
      form {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      .eyebrow {
        font-size: 11.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: rgba(240, 245, 240, 0.45);
      }
      .field input {
        padding: 12px 14px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #f2f4f2;
        font-family: inherit;
        font-size: 14.5px;
        font-weight: 500;
        transition: border-color 0.15s, background 0.15s;
      }
      .field input::placeholder {
        color: rgba(240, 245, 240, 0.3);
      }
      .field input:hover {
        border-color: rgba(255, 255, 255, 0.22);
      }
      .field input:focus {
        outline: none;
        border-color: var(--mint);
        background: rgba(255, 255, 255, 0.08);
      }
      .error {
        margin: 0;
        font-size: 13px;
        font-weight: 500;
        color: oklch(0.7 0.17 25);
      }
      .submit {
        width: 100%;
        padding: 14px;
        border: none;
        border-radius: 12px;
        background: linear-gradient(135deg, oklch(0.78 0.17 155), oklch(0.66 0.15 160));
        color: #0c1410;
        font-family: inherit;
        font-size: 15px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 10px 24px -10px oklch(0.72 0.16 155 / 0.55);
        transition: transform 0.12s ease, box-shadow 0.12s ease;
      }
      .submit:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 14px 30px -10px oklch(0.72 0.16 155 / 0.65);
      }
      .submit:active:not(:disabled) {
        transform: translateY(0);
      }
      .submit:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .link-btn {
        display: block;
        text-align: center;
        text-decoration: none;
      }
      .footer {
        margin: 0;
        font-size: 13px;
        font-weight: 500;
        color: rgba(240, 245, 240, 0.5);
      }
      .footer a {
        color: var(--mint-bright);
        font-weight: 700;
        text-decoration: none;
      }
      .footer a:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class SignupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly error = signal('');
  readonly done = signal(false);

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const { email, password, fullName } = this.form.getRawValue();
      await this.auth.signUp(email, password, fullName);
      this.done.set(true);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Sign up failed');
    } finally {
      this.loading.set(false);
    }
  }
}
