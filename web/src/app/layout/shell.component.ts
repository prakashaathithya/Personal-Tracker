import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
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
    MatIconModule,
    MatTooltipModule,
    LogoComponent,
  ],
  template: `
    <div class="frame">
      <div class="orb orb-teal"></div>
      <div class="orb orb-red"></div>
      <div class="orb orb-blue"></div>

      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">
            <app-logo [size]="20" [mono]="true" ink="#ffffff" />
          </span>
          <span class="brand-name">MoneyMap</span>
        </div>

        <p class="nav-heading">Menu</p>

        <nav class="nav">
          @for (item of nav; track item.path) {
            <a
              class="nav-item"
              [routerLink]="item.path"
              routerLinkActive="active"
            >
              <mat-icon>{{ item.icon }}</mat-icon>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

        <div class="sidebar-spacer"></div>

        <div class="divider"></div>

        <div class="user-row">
          <span class="avatar" [matTooltip]="auth.user()?.email ?? ''">
            {{ avatarInitial() }}
          </span>
          <span class="user-email">{{ auth.user()?.email }}</span>
        </div>

        <div class="footer-actions">
          <button
            class="footer-btn primary"
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
      </aside>

      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      .frame {
        position: relative;
        display: flex;
        height: 100vh;
        width: 100%;
        padding: 20px;
        gap: 20px;
        box-sizing: border-box;
        overflow: hidden;
      }

      /* Aurora orbs floating behind the glass panels */
      .orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(120px);
        pointer-events: none;
      }
      .orb-teal {
        width: 520px;
        height: 520px;
        top: -180px;
        left: -120px;
        background: light-dark(oklch(0.8 0.1 165 / 0.4), oklch(0.6 0.15 165 / 0.35));
      }
      .orb-red {
        width: 460px;
        height: 460px;
        top: 250px;
        right: -100px;
        background: light-dark(oklch(0.8 0.1 20 / 0.3), oklch(0.55 0.18 20 / 0.28));
      }
      .orb-blue {
        width: 400px;
        height: 400px;
        bottom: -120px;
        left: 35%;
        background: light-dark(oklch(0.78 0.09 250 / 0.35), oklch(0.55 0.14 250 / 0.3));
      }

      /* Floating glass sidebar */
      .sidebar {
        position: relative;
        z-index: 1;
        width: 264px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        background: var(--glass-bg-strong);
        -webkit-backdrop-filter: blur(24px);
        backdrop-filter: blur(24px);
        border: 1px solid var(--glass-border);
        border-radius: 22px;
        box-shadow:
          light-dark(0 8px 32px rgba(30, 50, 70, 0.15), 0 8px 32px rgba(0, 0, 0, 0.35)),
          inset 0 1px 0 var(--glass-highlight);
        padding: 18px 16px;
        box-sizing: border-box;
        overflow-y: auto;
        /* scroll silently if the window is short — no visible scrollbar */
        scrollbar-width: none;
      }
      .sidebar::-webkit-scrollbar { display: none; }

      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 6px 16px;
      }
      .brand-mark {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 10px;
        flex-shrink: 0;
        background: linear-gradient(135deg, oklch(0.78 0.16 165), oklch(0.6 0.16 170));
        box-shadow: 0 4px 14px oklch(0.6 0.16 170 / 0.5);
      }
      .brand-name {
        font-size: 19px;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--ink);
      }

      .nav-heading {
        margin: 0;
        padding: 6px 10px 6px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-faint);
      }

      .nav {
        display: flex;
        flex-direction: column;
      }
      .nav-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 9px 12px;
        border-radius: 12px;
        margin-bottom: 2px;
        cursor: pointer;
        text-decoration: none;
        color: var(--ink-soft);
        border: 1px solid transparent;
        font-size: 14.5px;
        font-weight: 500;
        transition: background 140ms ease, color 140ms ease;
      }
      .nav-item mat-icon {
        width: 20px;
        height: 20px;
        font-size: 20px;
        flex-shrink: 0;
      }
      .nav-item:hover:not(.active) {
        background: var(--hover-bg);
        color: var(--ink);
      }
      .nav-item.active {
        background: var(--accent-grad);
        border-color: rgba(255, 255, 255, 0.2);
        color: var(--on-accent);
        font-weight: 700;
        box-shadow: 0 4px 14px oklch(0.6 0.15 168 / 0.35);
      }

      .sidebar-spacer { flex: 1; }

      .divider {
        height: 1px;
        background: var(--hairline);
        margin: 8px 4px 10px;
      }

      .user-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 8px 10px;
      }
      .avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        flex-shrink: 0;
        font-weight: 700;
        font-size: 14px;
        color: var(--on-accent);
        background: linear-gradient(135deg, oklch(0.78 0.16 165), oklch(0.55 0.15 200));
      }
      .user-email {
        font-size: 13px;
        color: var(--ink-soft);
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
        padding: 9px 0;
        border-radius: 11px;
        background: light-dark(rgba(20, 45, 60, 0.05), rgba(255, 255, 255, 0.05));
        border: 1px solid light-dark(rgba(20, 45, 60, 0.12), rgba(255, 255, 255, 0.12));
        cursor: pointer;
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        color: var(--ink-soft);
        transition: background 140ms ease, color 140ms ease;
      }
      .footer-btn.primary {
        background: light-dark(rgba(20, 45, 60, 0.08), rgba(255, 255, 255, 0.08));
        border-color: light-dark(rgba(20, 45, 60, 0.18), rgba(255, 255, 255, 0.18));
        color: var(--ink);
      }
      .footer-btn:hover {
        background: var(--hover-bg);
        color: var(--ink);
      }
      .footer-btn mat-icon {
        width: 17px;
        height: 17px;
        font-size: 17px;
      }

      /* Scrollable content column beside the fixed sidebar */
      .content {
        position: relative;
        z-index: 1;
        flex: 1;
        min-width: 0;
        overflow-y: auto;
        overflow-x: hidden;
        border-radius: 22px;
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
