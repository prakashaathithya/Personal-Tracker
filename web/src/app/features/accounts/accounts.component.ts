import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/api.service';
import { AccountBalance, AccountType } from '../../core/models';

const TYPE_META: Record<AccountType, { label: string; icon: string }> = {
  cash: { label: 'Cash', icon: 'payments' },
  bank: { label: 'Bank', icon: 'account_balance' },
  credit_card: { label: 'Credit Card', icon: 'credit_card' },
  wallet: { label: 'Wallet', icon: 'wallet' },
  investment: { label: 'Investment', icon: 'trending_up' },
};

@Component({
  selector: 'app-accounts',
  imports: [
    CurrencyPipe,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Accounts</h1>
          <p class="page-subtitle">Balances across your cash, bank &amp; cards</p>
        </div>
        <span class="spacer"></span>
        <div class="networth">
          <div class="networth-label">NET WORTH</div>
          <div class="networth-value">{{ netWorth() | currency: 'INR' : 'symbol' : '1.0-0' }}</div>
        </div>
      </div>

      <div class="account-grid">
        @for (a of accounts(); track a.id) {
          <mat-card class="account-card">
            <mat-card-content>
              <div class="acc-top">
                <span class="acc-icon"><mat-icon>{{ icon(a.type) }}</mat-icon></span>
                <span class="acc-type">{{ typeLabel(a.type) }}</span>
                <span class="spacer"></span>
                <button matIconButton (click)="remove(a)" [disabled]="accounts().length <= 1">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
              <div class="acc-name">{{ a.name }}</div>
              <div class="acc-balance" [class.neg]="a.balance < 0">
                {{ a.balance | currency: 'INR' : 'symbol' : '1.0-0' }}
              </div>
              <div class="acc-opening">Opening {{ a.opening_balance | currency: 'INR' : 'symbol' : '1.0-0' }}</div>
            </mat-card-content>
          </mat-card>
        }
      </div>

      <mat-card class="add-card">
        <mat-card-content>
          <div class="card-title">Add an account</div>
          <div class="add-row">
            <input class="plain-input name" placeholder="e.g. HDFC Savings" [(ngModel)]="newName" />
            <mat-select class="type-select" [(ngModel)]="newType" panelWidth="">
              @for (t of types; track t.value) {
                <mat-option [value]="t.value">{{ t.label }}</mat-option>
              }
            </mat-select>
            <div class="plain-input-wrap amount">
              <span class="prefix">₹</span>
              <input class="plain-input" type="number" placeholder="Opening" [(ngModel)]="newOpening" />
            </div>
            <button class="action-btn" (click)="add()" [disabled]="!newName">
              <mat-icon>add</mat-icon> Add
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .page-subtitle { margin: 4px 0 0; font-size: 0.9rem; color: var(--mat-sys-on-surface-variant); }
      .networth { text-align: right; }
      .networth-label {
        font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em;
        color: var(--mat-sys-on-surface-variant);
      }
      .networth-value {
        font-family: 'Sora', sans-serif; font-weight: 700; font-size: 1.6rem;
        color: light-dark(#0f9d76, #34d399);
      }

      .account-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 16px;
        margin-bottom: 20px;
      }
      .acc-top { display: flex; align-items: center; gap: 8px; }
      .acc-icon {
        display: grid; place-items: center; width: 32px; height: 32px;
        border-radius: 9px;
        background: color-mix(in srgb, var(--mat-sys-primary) 16%, transparent);
        color: var(--mat-sys-primary);
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
      .acc-type {
        font-size: 0.72rem; font-weight: 700; letter-spacing: 0.05em;
        text-transform: uppercase; color: var(--mat-sys-on-surface-variant);
      }
      .acc-name { font-weight: 600; margin-top: 12px; }
      .acc-balance {
        font-family: 'Sora', sans-serif; font-size: 1.5rem; font-weight: 700; margin-top: 4px;
      }
      .acc-balance.neg { color: light-dark(#dc2626, #f87171); }
      .acc-opening { font-size: 0.78rem; color: var(--mat-sys-on-surface-variant); margin-top: 4px; }

      .card-title { font-weight: 700; font-size: 1.05rem; margin-bottom: 14px; }
      .add-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
      .plain-input {
        height: 44px; padding: 0 14px; border-radius: 10px;
        border: 1px solid light-dark(#dbe7e1, #2c3a33);
        background: light-dark(#ffffff, #202a25); color: inherit;
        font-family: inherit; font-size: 0.92rem; box-sizing: border-box; outline: none;
      }
      .plain-input:focus { border-color: var(--mat-sys-primary); }
      .plain-input.name { flex: 1 1 200px; }
      .type-select {
        min-width: 150px; height: 44px; padding: 0 14px; border-radius: 10px;
        border: 1px solid light-dark(#dbe7e1, #2c3a33);
        background: light-dark(#ffffff, #202a25); display: flex; align-items: center;
      }
      .plain-input-wrap { position: relative; display: flex; align-items: center; }
      .plain-input-wrap.amount { width: 150px; }
      .plain-input-wrap .prefix {
        position: absolute; left: 14px; color: var(--mat-sys-on-surface-variant);
        font-size: 0.9rem; pointer-events: none;
      }
      .plain-input-wrap .prefix + .plain-input { padding-left: 28px; width: 100%; }
      .action-btn {
        background: linear-gradient(135deg, #34d399 0%, #10b981 55%, #0d9488 100%);
        color: #fff; border: none; border-radius: 10px; padding: 0 20px; height: 44px;
        font-weight: 600; font-size: 0.92rem; display: inline-flex; align-items: center;
        justify-content: center; gap: 6px; cursor: pointer; white-space: nowrap;
      }
      .action-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
      .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    `,
  ],
})
export class AccountsComponent {
  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);

  readonly accounts = signal<AccountBalance[]>([]);
  readonly netWorth = computed(() =>
    this.accounts().reduce((sum, a) => sum + Number(a.balance), 0),
  );

  readonly types = (Object.keys(TYPE_META) as AccountType[]).map((value) => ({
    value,
    label: TYPE_META[value].label,
  }));

  newName = '';
  newType: AccountType = 'bank';
  newOpening: number | null = null;

  constructor() {
    this.load();
  }

  private load() {
    this.api.accountBalances().subscribe((r) => this.accounts.set(r.accounts));
  }

  icon(t: AccountType) {
    return TYPE_META[t].icon;
  }
  typeLabel(t: AccountType) {
    return TYPE_META[t].label;
  }

  add() {
    if (!this.newName) return;
    this.api
      .createAccount({
        name: this.newName,
        type: this.newType,
        opening_balance: Number(this.newOpening ?? 0),
      })
      .subscribe({
        next: () => {
          this.snack.open('Account added', 'OK', { duration: 2000 });
          this.newName = '';
          this.newOpening = null;
          this.load();
        },
        error: () => this.snack.open('Failed to add account', 'OK', { duration: 3000 }),
      });
  }

  remove(a: AccountBalance) {
    if (!confirm(`Delete "${a.name}"? Its transactions will be kept but unlinked.`)) return;
    this.api.deleteAccount(a.id).subscribe({
      next: () => {
        this.snack.open('Account deleted', 'OK', { duration: 2000 });
        this.load();
      },
      error: () => this.snack.open('Delete failed', 'OK', { duration: 3000 }),
    });
  }
}
