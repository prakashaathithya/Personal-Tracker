import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { filter, map } from 'rxjs';
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
  /** Shorter caption for the cramped bottom tab bar. */
  short?: string;
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

      <!-- Mobile top bar: brand + the two actions that live in the
           sidebar footer on desktop. -->
      <header class="topbar">
        <span class="brand-mark">
          <app-logo [size]="18" [mono]="true" ink="#ffffff" />
        </span>
        <span class="brand-name">MoneyMap</span>
        <span class="sidebar-spacer"></span>
        <button class="icon-btn" (click)="theme.toggle()" [attr.aria-label]="theme.isDark() ? 'Light mode' : 'Dark mode'">
          <mat-icon>{{ theme.isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
        </button>
        <button class="icon-btn" (click)="logout()" aria-label="Log out">
          <mat-icon>logout</mat-icon>
        </button>
      </header>

      <main class="content">
        <router-outlet />
      </main>

      <!-- Mobile bottom tab bar: four primary destinations + More. -->
      <nav class="tabbar">
        @for (item of primaryNav; track item.path) {
          <a class="tab" [routerLink]="item.path" routerLinkActive="active">
            <mat-icon>{{ item.icon }}</mat-icon>
            <span>{{ item.short ?? item.label }}</span>
          </a>
        }
        <button
          class="tab"
          type="button"
          [class.active]="moreOpen() || moreSectionActive()"
          (click)="moreOpen.set(!moreOpen())"
        >
          <mat-icon>more_horiz</mat-icon>
          <span>More</span>
        </button>
      </nav>

      @if (moreOpen()) {
        <div class="sheet-scrim" (click)="moreOpen.set(false)"></div>
        <div class="sheet" role="dialog" aria-label="More pages">
          <span class="sheet-grip"></span>

          <div class="sheet-user">
            <span class="avatar">{{ avatarInitial() }}</span>
            <span class="user-email">{{ auth.user()?.email }}</span>
          </div>

          <div class="sheet-grid">
            @for (item of moreNav; track item.path) {
              <a
                class="sheet-item"
                [routerLink]="item.path"
                routerLinkActive="active"
                (click)="moreOpen.set(false)"
              >
                <mat-icon>{{ item.icon }}</mat-icon>
                <span>{{ item.label }}</span>
              </a>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .frame {
        position: relative;
        display: flex;
        /* dvh, not vh: mobile browsers count the collapsing URL bar in vh,
           which leaves the last ~60px of every page unreachable. */
        height: 100dvh;
        width: 100%;
        padding: 20px;
        gap: 20px;
        box-sizing: border-box;
        overflow: hidden;
      }

      /* Mobile-only chrome — hidden until the sidebar steps aside. */
      .topbar,
      .tabbar,
      .sheet,
      .sheet-scrim {
        display: none;
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

      /* ============================================================ *
       *  Mobile / tablet: sidebar out, top bar + bottom tabs in.
       * ============================================================ */
      @media (max-width: 1024px) {
        .frame {
          display: block;
          padding: 0;
          gap: 0;
        }

        .sidebar {
          display: none;
        }

        /* Orbs stay as background texture but shrink — at 520px they
           washed out the whole phone screen. */
        .orb {
          filter: blur(90px);
        }
        .orb-teal { width: 300px; height: 300px; top: -110px; left: -80px; }
        .orb-red { width: 280px; height: 280px; top: 40%; right: -90px; }
        .orb-blue { width: 260px; height: 260px; bottom: -80px; left: 20%; }

        .topbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          gap: 10px;
          height: calc(56px + var(--safe-top));
          padding: var(--safe-top) calc(12px + var(--safe-right)) 0 calc(14px + var(--safe-left));
          box-sizing: border-box;
          background: var(--glass-bg-strong);
          -webkit-backdrop-filter: blur(24px);
          backdrop-filter: blur(24px);
          border-bottom: 1px solid var(--hairline);
        }
        .topbar .brand-mark {
          width: 28px;
          height: 28px;
          border-radius: 9px;
        }
        .topbar .brand-name {
          font-size: 17px;
        }

        .icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          border: none;
          border-radius: 12px;
          background: transparent;
          color: var(--ink-soft);
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .icon-btn mat-icon {
          width: 21px;
          height: 21px;
          font-size: 21px;
        }
        .icon-btn:active { background: var(--hover-bg); }

        .content {
          height: 100dvh;
          box-sizing: border-box;
          border-radius: 0;
          /* Clear the fixed top bar and bottom tab bar at both ends. */
          padding: calc(56px + var(--safe-top) + 14px)
                   calc(14px + var(--safe-right))
                   calc(68px + var(--safe-bottom) + 16px)
                   calc(14px + var(--safe-left));
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
        }

        .tabbar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 20;
          display: flex;
          align-items: stretch;
          height: calc(68px + var(--safe-bottom));
          padding: 0 calc(6px + var(--safe-right)) var(--safe-bottom) calc(6px + var(--safe-left));
          box-sizing: border-box;
          background: var(--glass-bg-strong);
          -webkit-backdrop-filter: blur(24px);
          backdrop-filter: blur(24px);
          border-top: 1px solid var(--hairline);
        }

        .tab {
          position: relative;
          flex: 1 1 0;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          padding: 8px 2px;
          border: none;
          background: transparent;
          font-family: inherit;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: var(--ink-faint);
          text-decoration: none;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: color 140ms ease;
        }
        .tab span {
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .tab mat-icon {
          width: 23px;
          height: 23px;
          font-size: 23px;
          flex-shrink: 0;
        }
        /* Active tab: the mint gradient reads as a lozenge behind the
           icon only, so the label stays legible at 10px. */
        .tab.active {
          color: var(--accent-ink);
        }
        .tab.active::before {
          content: '';
          position: absolute;
          top: 6px;
          width: 46px;
          height: 30px;
          border-radius: 999px;
          background: var(--accent-grad);
          opacity: 0.9;
        }
        .tab.active mat-icon {
          position: relative;
          color: var(--on-accent);
        }

        /* ---- "More" bottom sheet ---- */
        .sheet-scrim {
          display: block;
          position: fixed;
          inset: 0;
          z-index: 25;
          background: light-dark(rgba(30, 45, 60, 0.3), rgba(3, 6, 10, 0.5));
          -webkit-backdrop-filter: blur(6px);
          backdrop-filter: blur(6px);
          animation: fade-in 160ms ease;
        }

        .sheet {
          display: block;
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 26;
          padding: 8px 16px calc(16px + var(--safe-bottom));
          box-sizing: border-box;
          background: light-dark(rgba(255, 255, 255, 0.82), rgba(26, 32, 42, 0.9));
          -webkit-backdrop-filter: blur(28px) saturate(150%);
          backdrop-filter: blur(28px) saturate(150%);
          border-top: 1px solid var(--glass-border);
          border-radius: 24px 24px 0 0;
          box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.35);
          animation: slide-up 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .sheet-grip {
          display: block;
          width: 40px;
          height: 4px;
          margin: 0 auto 14px;
          border-radius: 999px;
          background: var(--ink-faint);
          opacity: 0.4;
        }

        .sheet-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 4px 14px;
          margin-bottom: 12px;
          border-bottom: 1px solid var(--hairline);
        }
        .sheet-user .avatar {
          width: 32px;
          height: 32px;
          font-size: 13px;
        }

        .sheet-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .sheet-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 82px;
          padding: 12px 6px;
          border-radius: 16px;
          border: 1px solid var(--hairline);
          background: var(--surface-2);
          color: var(--ink-soft);
          font-size: 11.5px;
          font-weight: 600;
          text-align: center;
          text-decoration: none;
          -webkit-tap-highlight-color: transparent;
        }
        .sheet-item mat-icon {
          width: 24px;
          height: 24px;
          font-size: 24px;
        }
        .sheet-item.active {
          background: var(--accent-grad);
          border-color: rgba(255, 255, 255, 0.2);
          color: var(--on-accent);
        }

        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      }

      /* Very narrow phones: 3 columns of tiles get tight. */
      @media (max-width: 360px) {
        .sheet-grid { grid-template-columns: repeat(2, 1fr); }
        .tab { font-size: 10px; }
      }

      @media (prefers-reduced-motion: reduce) {
        .sheet, .sheet-scrim { animation: none; }
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

  /** Mobile "More" sheet visibility. */
  readonly moreOpen = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Keeps the More tab lit while one of its pages is open. */
  readonly moreSectionActive = computed(() =>
    this.moreNav.some((i) => this.url().startsWith(`/${i.path}`)),
  );

  constructor() {
    // Catch-up: post any recurring transactions that came due while away.
    // (A nightly pg_cron job also does this server-side for all users.)
    this.api.runRecurring().subscribe({ error: () => undefined });

    // Dismiss the More sheet on any navigation — including the Android
    // back button, which the in-template click handler never sees.
    effect(() => {
      this.url();
      this.moreOpen.set(false);
    });
  }

  /** Bottom tab bar on mobile; also the first four sidebar entries. */
  readonly primaryNav: NavItem[] = [
    { path: 'dashboard', label: 'Dashboard', icon: 'dashboard', short: 'Home' },
    { path: 'transactions', label: 'Transactions', icon: 'receipt_long', short: 'Txns' },
    { path: 'accounts', label: 'Accounts', icon: 'account_balance_wallet', short: 'Accounts' },
    { path: 'budget', label: 'Budget', icon: 'savings', short: 'Budget' },
  ];

  /** Behind the "More" sheet on mobile; rest of the sidebar on desktop. */
  readonly moreNav: NavItem[] = [
    { path: 'goals', label: 'Goals', icon: 'flag' },
    { path: 'loans', label: 'Loans / EMI', icon: 'account_balance' },
    { path: 'recurring', label: 'Recurring', icon: 'event_repeat' },
    { path: 'rules', label: 'Rules', icon: 'rule' },
    { path: 'import', label: 'Import Excel', icon: 'upload_file' },
    { path: 'settings', label: 'Settings', icon: 'settings' },
  ];

  /** Full sidebar list (desktop). */
  readonly nav: NavItem[] = [...this.primaryNav, ...this.moreNav];

  async logout() {
    await this.auth.signOut();
    void this.router.navigate(['/login']);
  }
}
