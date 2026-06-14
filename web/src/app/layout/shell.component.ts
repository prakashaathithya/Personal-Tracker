import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../core/auth.service';

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
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
  ],
  template: `
    <mat-toolbar color="primary" class="toolbar">
      <button matIconButton (click)="opened.set(!opened())" aria-label="Menu">
        <mat-icon>menu</mat-icon>
      </button>
      <span>Finance Tracker</span>
      <span class="spacer"></span>
      <span class="email">{{ auth.user()?.email }}</span>
      <button matIconButton (click)="logout()" aria-label="Log out">
        <mat-icon>logout</mat-icon>
      </button>
    </mat-toolbar>

    <mat-sidenav-container class="container">
      <mat-sidenav [opened]="opened()" mode="side" class="sidenav">
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
      </mat-sidenav>

      <mat-sidenav-content>
        <router-outlet />
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .toolbar {
        position: sticky;
        top: 0;
        z-index: 10;
      }
      .email {
        font-size: 0.85rem;
        margin-right: 8px;
        opacity: 0.9;
      }
      .container {
        height: calc(100vh - 64px);
      }
      .sidenav {
        width: 230px;
      }
    `,
  ],
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly opened = signal(true);

  readonly nav: NavItem[] = [
    { path: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: 'transactions', label: 'Transactions', icon: 'receipt_long' },
    { path: 'budget', label: 'Budget', icon: 'savings' },
    { path: 'loans', label: 'Loans / EMI', icon: 'account_balance' },
    { path: 'import', label: 'Import Excel', icon: 'upload_file' },
    { path: 'settings', label: 'Settings', icon: 'settings' },
  ];

  async logout() {
    await this.auth.signOut();
    void this.router.navigate(['/login']);
  }
}
