import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-signup',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="auth-wrap">
      <mat-card class="auth-card">
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" />
        }
        <mat-card-header>
          <mat-card-title>Create your account</mat-card-title>
          <mat-card-subtitle>Start tracking your finances</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (done()) {
            <p class="success">
              Account created! Check your email to confirm your address, then sign in.
            </p>
            <a matButton="filled" routerLink="/login">Go to sign in</a>
          } @else {
            <form [formGroup]="form" (ngSubmit)="submit()">
              <mat-form-field class="full-width">
                <mat-label>Full name</mat-label>
                <input matInput formControlName="fullName" autocomplete="name" />
              </mat-form-field>
              <mat-form-field class="full-width">
                <mat-label>Email</mat-label>
                <input matInput type="email" formControlName="email" autocomplete="email" />
              </mat-form-field>
              <mat-form-field class="full-width">
                <mat-label>Password</mat-label>
                <input matInput type="password" formControlName="password" autocomplete="new-password" />
                <mat-hint>At least 6 characters</mat-hint>
              </mat-form-field>
              @if (error()) {
                <p class="error">{{ error() }}</p>
              }
              <button matButton="filled" class="full-width" type="submit" [disabled]="loading() || form.invalid">
                Sign up
              </button>
            </form>
          }
        </mat-card-content>
        <mat-card-actions>
          <span>Already have an account?</span>
          <a matButton routerLink="/login">Sign in</a>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .auth-wrap {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .auth-card { width: 100%; max-width: 400px; overflow: hidden; }
      mat-card-content { margin-top: 16px; }
      .error { color: #c62828; margin: 4px 0 12px; }
      .success { color: #2e7d32; margin-bottom: 12px; }
      button[type='submit'] { margin-top: 8px; }
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
