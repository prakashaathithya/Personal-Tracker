import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/api.service';
import { AccountBalance, SavingsGoal } from '../../core/models';

interface GoalView extends SavingsGoal {
  current: number;
  percent: number;
}

@Component({
  selector: 'app-goals',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Savings goals</h1>
          <p class="page-subtitle">Track progress toward what you're saving for</p>
        </div>
      </div>

      <mat-card class="add-card">
        <mat-card-content>
          <div class="card-title">New goal</div>
          <div class="add-row">
            <input class="plain-input grow" placeholder="e.g. Emergency fund" [(ngModel)]="f.name" />
            <div class="plain-input-wrap">
              <span class="prefix">₹</span>
              <input class="plain-input amt" type="number" placeholder="Target" [(ngModel)]="f.target_amount" />
            </div>
            <select class="plain-input" [(ngModel)]="f.account_id">
              <option [ngValue]="null">Track manually</option>
              @for (a of accounts(); track a.id) {
                <option [ngValue]="a.id">Track {{ a.name }}</option>
              }
            </select>
            <input class="plain-input" type="date" [(ngModel)]="f.target_date" />
            <button class="action-btn" (click)="add()" [disabled]="!f.name || !f.target_amount">
              <mat-icon>add</mat-icon> Add
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <div class="goal-grid">
        @for (g of goals(); track g.id) {
          <mat-card class="goal-card">
            <mat-card-content>
              <div class="goal-top">
                <span class="goal-name">{{ g.name }}</span>
                <span class="spacer"></span>
                <button matIconButton (click)="remove(g)"><mat-icon>delete</mat-icon></button>
              </div>
              <div class="goal-amounts">
                <span class="cur">{{ g.current | currency: 'INR' : 'symbol' : '1.0-0' }}</span>
                <span class="of">of {{ g.target_amount | currency: 'INR' : 'symbol' : '1.0-0' }}</span>
              </div>
              <mat-progress-bar mode="determinate" [value]="g.percent" />
              <div class="goal-foot">
                <span class="pct">{{ g.percent }}%</span>
                <span class="spacer"></span>
                @if (g.account) {
                  <span class="link"><mat-icon>link</mat-icon> {{ g.account.name }}</span>
                } @else {
                  <span class="manual">
                    <input
                      class="mini-input"
                      type="number"
                      [ngModel]="g.current_amount"
                      (ngModelChange)="setCurrent(g, $event)"
                    />
                  </span>
                }
                @if (g.target_date) {
                  <span class="date">by {{ g.target_date | date: 'MMM yyyy' }}</span>
                }
              </div>
            </mat-card-content>
          </mat-card>
        }
        @if (!goals().length) {
          <p class="empty">No goals yet. Add one above to start tracking.</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .page-subtitle { margin: 4px 0 0; font-size: 0.9rem; color: var(--mat-sys-on-surface-variant); }
      .card-title { font-weight: 700; font-size: 1.05rem; margin-bottom: 14px; }
      .add-card { margin-bottom: 16px; }
      .add-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .plain-input {
        height: 44px; padding: 0 12px; border-radius: 10px;
        border: 1px solid var(--field-border);
        background: var(--field-bg); color: inherit;
        font-family: inherit; font-size: 0.92rem; box-sizing: border-box; outline: none;
      }
      .plain-input:focus { border-color: var(--mat-sys-primary); }
      .plain-input.grow { flex: 1 1 180px; }
      .plain-input-wrap { position: relative; display: flex; align-items: center; }
      .plain-input-wrap .prefix { position: absolute; left: 12px; color: var(--mat-sys-on-surface-variant); }
      .plain-input.amt { padding-left: 26px; width: 140px; }
      .action-btn {
        background: var(--accent-grad);
        color: #fff; border: none; border-radius: 10px; padding: 0 18px; height: 44px;
        font-weight: 600; font-size: 0.9rem; display: inline-flex; align-items: center;
        justify-content: center; gap: 6px; cursor: pointer; white-space: nowrap;
      }
      .action-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
      .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      .goal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr)); gap: 16px; }
      .goal-top { display: flex; align-items: center; }
      .goal-name { font-weight: 700; font-size: 1.05rem; }
      .goal-amounts { margin: 6px 0 10px; }
      .goal-amounts .cur {
        font-family: 'Inter', sans-serif; font-size: 1.4rem; font-weight: 700;
        color: var(--accent-ink);
      }
      .goal-amounts .of { color: var(--mat-sys-on-surface-variant); margin-left: 6px; font-size: 0.85rem; }
      .goal-foot {
        display: flex; align-items: center; gap: 10px; margin-top: 10px;
        font-size: 0.8rem; color: var(--mat-sys-on-surface-variant);
      }
      .goal-foot .pct { font-weight: 700; color: var(--mat-sys-on-surface); }
      .goal-foot .link { display: inline-flex; align-items: center; gap: 3px; }
      .goal-foot .link mat-icon { font-size: 14px; width: 14px; height: 14px; }
      .mini-input {
        width: 110px; height: 32px; padding: 0 8px; border-radius: 8px;
        border: 1px solid var(--field-border);
        background: var(--field-bg); color: inherit; font-family: inherit;
      }
      .empty { color: var(--mat-sys-on-surface-variant); }

      /* ---- Phone ---- */
      @media (max-width: 700px) {
        .goal-grid { grid-template-columns: 1fr; gap: 12px; }
        .add-row > * { flex: 1 1 100% !important; width: 100%; }
        .plain-input.amt { width: 100%; }
        .plain-input, .action-btn { height: 48px; }
        .plain-input { font-size: 16px; }
        .goal-amounts .cur { font-size: 1.25rem; }
        /* The inline "add to goal" input sits next to a button — keep it
           roomy enough to tap but let it share the row. */
        .mini-input { flex: 1 1 auto; width: auto; height: 40px; font-size: 16px; }
        .goal-foot { flex-wrap: wrap; }
      }
    `,
  ],
})
export class GoalsComponent {
  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);

  private readonly rawGoals = signal<SavingsGoal[]>([]);
  private readonly balances = signal<AccountBalance[]>([]);
  readonly accounts = computed(() => this.balances());

  readonly goals = computed<GoalView[]>(() => {
    const balById = new Map(this.balances().map((a) => [a.id, a.balance]));
    return this.rawGoals().map((g) => {
      const current = g.account_id
        ? Number(balById.get(g.account_id) ?? 0)
        : Number(g.current_amount);
      const percent = g.target_amount
        ? Math.min(Math.max(Math.round((current / g.target_amount) * 100), 0), 100)
        : 0;
      return { ...g, current, percent };
    });
  });

  f: {
    name: string;
    target_amount: number | null;
    account_id: string | null;
    target_date: string;
  } = { name: '', target_amount: null, account_id: null, target_date: '' };

  constructor() {
    this.load();
  }

  private load() {
    forkJoin({
      goals: this.api.listGoals(),
      balances: this.api.accountBalances(),
    }).subscribe((r) => {
      this.rawGoals.set(r.goals);
      this.balances.set(r.balances.accounts);
    });
  }

  add() {
    if (!this.f.name || !this.f.target_amount) return;
    this.api
      .createGoal({
        name: this.f.name,
        target_amount: Number(this.f.target_amount),
        account_id: this.f.account_id ?? undefined,
        target_date: this.f.target_date || undefined,
      })
      .subscribe({
        next: () => {
          this.f = { name: '', target_amount: null, account_id: null, target_date: '' };
          this.load();
        },
        error: () => this.snack.open('Could not add goal', 'OK', { duration: 3000 }),
      });
  }

  setCurrent(g: SavingsGoal, current_amount: number) {
    this.api.updateGoal(g.id, { current_amount: Number(current_amount) || 0 }).subscribe(() => {
      this.rawGoals.update((gs) =>
        gs.map((x) => (x.id === g.id ? { ...x, current_amount } : x)),
      );
    });
  }

  remove(g: SavingsGoal) {
    this.api.deleteGoal(g.id).subscribe(() => this.load());
  }
}
