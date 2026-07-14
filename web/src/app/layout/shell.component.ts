import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';
import { LogoComponent } from '../shared/logo.component';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    LogoComponent,
  ],
  template: `
    <mat-sidenav-container class="container">
      <mat-sidenav [opened]="true" mode="side" class="sidenav">
        <div class="brand">
          <app-logo [size]="30" />
          <span class="brand-name">MoneyMap</span>
        </div>

        <p class="nav-heading">Menu</p>

        <mat-nav-list>
          @for (item of nav; track item.path) {
            <a
              mat-list-item
              [routerLink]="item.path"
              routerLinkActive
              #rla="routerLinkActive"
              [activated]="rla.isActive"
            >
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>

        <div class="sidenav-footer">
          <div class="user-row">
            <span class="avatar-btn" [matTooltip]="auth.user()?.email ?? ''">
              {{ avatarInitial() }}
            </span>
            <span class="user-email">{{ auth.user()?.email }}</span>
          </div>
          <div class="footer-actions">
            <button
              class="footer-btn"
              (click)="theme.toggle()"
              [matTooltip]="theme.isDark() ? 'Light mode' : 'Dark mode'"
            >
              <mat-icon>{{ theme.isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
              <span>{{ theme.isDark() ? 'Light' : 'Dark' }}</span>
            </button>
            <button class="footer-btn" (click)="logout()" matTooltip="Log out">
              <mat-icon>logout</mat-icon>
              <span>Log out</span>
            </button>
          </div>
        </div>
      </mat-sidenav>

      <mat-sidenav-content>
        <router-outlet />
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .container {
        height: 100vh;
      }
      .sidenav {
        width: 250px;
      }
      /* Material wraps sidenav content in this inner container — make it the
         full-height flex column so the footer can be pushed to the bottom */
      .sidenav ::ng-deep .mat-drawer-inner-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 18px 12px;
        box-sizing: border-box;
      }
      .sidenav .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 4px 10px 14px;
        margin-bottom: 6px;
        border-bottom: 1px solid light-dark(#eef4f1, #202a25);
      }
      .sidenav .brand-name {
        font-family: 'Sora', sans-serif;
        font-weight: 700;
        font-size: 1.2rem;
        letter-spacing: -0.01em;
        color: var(--mat-sys-on-surface);
      }
      .sidenav .nav-heading {
        margin: 8px 0 2px;
        padding: 0 14px;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--mat-sys-on-surface-variant);
      }
      /* kill Material's default 8px top padding so the list hugs the heading */
      .sidenav mat-nav-list {
        padding-top: 0;
      }
      /* push the footer to the bottom of the sidebar */
      .sidenav-footer {
        margin-top: auto;
        padding-top: 12px;
        border-top: 1px solid light-dark(#eef4f1, #202a25);
      }
      .user-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 4px 8px 10px;
      }
      .avatar-btn {
        flex: none;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: none;
        display: grid;
        place-items: center;
        font-family: 'Sora', sans-serif;
        font-weight: 700;
        font-size: 0.95rem;
        color: #ffffff;
        background: linear-gradient(135deg, #34d399 0%, #10b981 55%, #0d9488 100%);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.45),
          0 3px 0 #0b7f66,
          0 6px 12px rgba(16, 185, 129, 0.35);
      }
      .user-email {
        font-size: 0.8rem;
        color: var(--mat-sys-on-surface-variant);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .footer-actions {
        display: flex;
        gap: 8px;
      }
      .footer-btn {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px 10px;
        border: 1px solid light-dark(#e2efe9, #24312b);
        border-radius: 10px;
        background: transparent;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--mat-sys-on-surface-variant);
        transition:
          background 0.15s ease,
          color 0.15s ease;
      }
      .footer-btn:hover {
        background: light-dark(#eef4f1, #202a25);
        color: var(--mat-sys-on-surface);
      }
      .footer-btn mat-icon {
        width: 18px;
        height: 18px;
        font-size: 18px;
      }
    `,
  ],
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);

  readonly avatarInitial = computed(() => (this.auth.user()?.email ?? '?').charAt(0).toUpperCase());

  constructor() {
    // Catch-up: post any recurring transactions that came due while away.
    // (A nightly pg_cron job also does this server-side for all users.)
    this.api.runRecurring().subscribe({ error: () => undefined });
  }

  readonly nav: NavItem[] = [
    { path: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: 'transactions', label: 'Transactions', icon: 'receipt_long' },
    { path: 'accounts', label: 'Accounts', icon: 'account_balance_wallet' },
    { path: 'budget', label: 'Budget', icon: 'savings' },
    { path: 'goals', label: 'Goals', icon: 'flag' },
    { path: 'loans', label: 'Loans / EMI', icon: 'account_balance' },
    { path: 'recurring', label: 'Recurring', icon: 'event_repeat' },
    { path: 'rules', label: 'Rules', icon: 'rule' },
    { path: 'import', label: 'Import Excel', icon: 'upload_file' },
    { path: 'settings', label: 'Settings', icon: 'settings' },
  ];

  async logout() {
    await this.auth.signOut();
    void this.router.navigate(['/login']);
  }
}
