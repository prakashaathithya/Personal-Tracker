import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/api.service';
import { BudgetItem, MonthlyBudget } from '../../core/models';

@Component({
  selector: 'app-budgets',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Budget</h1>
          <p class="page-subtitle">Recurring commitments &amp; the salary that funds them</p>
        </div>
        <span class="spacer"></span>
        @if (latestBudget(); as b) {
          <div class="month-badge">{{ b.month | date: 'MMM yyyy' }}</div>
        }
      </div>

      <div class="stat-cards">
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-top">
              <span class="stat-label">MONTHLY SALARY</span>
              <span class="stat-icon">💰</span>
            </div>
            <div class="stat-value">{{ monthlySalary() | currency: 'INR' : 'symbol' : '1.0-0' }}</div>
            <div class="stat-sub">
              Latest saved
              @if (latestBudget(); as b) {
                &middot; {{ b.month | date: 'MMM yyyy' }}
              }
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-top">
              <span class="stat-label">RECURRING / MO</span>
              <span class="stat-icon icon-blue"><mat-icon>autorenew</mat-icon></span>
            </div>
            <div class="stat-value">{{ itemsTotal() | currency: 'INR' : 'symbol' : '1.0-0' }}</div>
            <div class="stat-sub">{{ items().length }} item{{ items().length === 1 ? '' : 's' }} committed</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card highlight">
          <mat-card-content>
            <div class="stat-top">
              <span class="stat-label">FREE TO SPEND</span>
              <span class="stat-icon">✨</span>
            </div>
            <div class="stat-value">{{ freeToSpend() | currency: 'INR' : 'symbol' : '1.0-0' }}</div>
            <div class="stat-sub">{{ freePercent() }}% of salary left</div>
          </mat-card-content>
        </mat-card>
      </div>

      <mat-card class="progress-card">
        <mat-card-content>
          <div class="progress-header">
            <span class="progress-title">Salary committed to recurring items</span>
            <span class="spacer"></span>
            <span class="progress-amounts">
              {{ itemsTotal() | currency: 'INR' : 'symbol' : '1.0-0' }} of
              {{ monthlySalary() | currency: 'INR' : 'symbol' : '1.0-0' }}
            </span>
            <div class="progress-percent">
              <div class="progress-percent-value">{{ committedPercent() }}%</div>
              <div class="progress-percent-label">committed</div>
            </div>
          </div>
          <mat-progress-bar mode="determinate" [value]="committedPercent()" />
        </mat-card-content>
      </mat-card>

      <div class="grid">
        <mat-card>
          <mat-card-content>
            <div class="card-head">
              <div>
                <div class="card-title">Recurring monthly items</div>
                <div class="card-subtitle">Fixed costs that repeat every month</div>
              </div>
              <span class="spacer"></span>
              <div class="card-total">
                <div class="card-total-label">TOTAL</div>
                <div class="card-total-value">{{ itemsTotal() | currency: 'INR' : 'symbol' : '1.0-0' }}</div>
              </div>
            </div>

            <div class="add-box">
              <div class="field-label">Add an item</div>
              <div class="add-row">
                <input class="plain-input" placeholder="e.g. Home Rent" [(ngModel)]="newName" />
                <div class="plain-input-wrap amount">
                  <span class="prefix">₹</span>
                  <input class="plain-input" type="number" placeholder="Amount" [(ngModel)]="newAmount" />
                </div>
                <button class="action-btn" (click)="addItem()" [disabled]="!newName">
                  <mat-icon>add</mat-icon> Add
                </button>
              </div>
            </div>

            <table mat-table [dataSource]="items()" class="full-width">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Name</th>
                <td mat-cell *matCellDef="let i"><span class="dot"></span>{{ i.name }}</td>
              </ng-container>
              <ng-container matColumnDef="amount">
                <th mat-header-cell *matHeaderCellDef class="text-right">Amount</th>
                <td mat-cell *matCellDef="let i" class="text-right">
                  {{ i.amount | currency: 'INR' : 'symbol' : '1.0-0' }}
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let i" class="text-right">
                  <button matIconButton (click)="removeItem(i)"><mat-icon>delete</mat-icon></button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="itemColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: itemColumns"></tr>
            </table>
            <div class="table-total">
              <span>Total per month</span>
              <span>{{ itemsTotal() | currency: 'INR' : 'symbol' : '1.0-0' }}</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-content>
            <div class="card-head">
              <div>
                <div class="card-title">Monthly salary</div>
                <div class="card-subtitle">Used for salary-vs-usage on the dashboard</div>
              </div>
            </div>

            <div class="add-box">
              <div class="field">
                <label class="field-label">Month</label>
                <div class="plain-input-wrap">
                  <input
                    class="plain-input has-suffix"
                    readonly
                    [matDatepicker]="picker"
                    [(ngModel)]="newMonth"
                    (click)="picker.open()"
                  />
                  <mat-datepicker-toggle class="suffix-icon" [for]="picker" />
                  <mat-datepicker #picker startView="multi-year" />
                </div>
              </div>
              <div class="field">
                <label class="field-label">Salary</label>
                <div class="plain-input-wrap">
                  <span class="prefix">₹</span>
                  <input class="plain-input" type="number" [(ngModel)]="newSalary" />
                </div>
              </div>
              <button class="action-btn full-width" (click)="saveSalary()" [disabled]="!newMonth">
                <mat-icon>save</mat-icon> Save salary
              </button>
            </div>

            <table mat-table [dataSource]="budgets()" class="full-width">
              <ng-container matColumnDef="month">
                <th mat-header-cell *matHeaderCellDef>Month</th>
                <td mat-cell *matCellDef="let b">{{ b.month | date: 'MMM yyyy' }}</td>
              </ng-container>
              <ng-container matColumnDef="salary">
                <th mat-header-cell *matHeaderCellDef class="text-right">Salary</th>
                <td mat-cell *matCellDef="let b" class="text-right">
                  {{ b.salary | currency: 'INR' : 'symbol' : '1.0-0' }}
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="budgetColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: budgetColumns"></tr>
            </table>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      .page-subtitle {
        margin: 4px 0 0;
        font-size: 0.9rem;
        color: var(--mat-sys-on-surface-variant);
      }
      .month-badge {
        font-weight: 600;
        color: var(--mat-sys-on-surface-variant);
      }

      .stat-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-bottom: 20px;
      }
      .stat-top { display: flex; align-items: center; justify-content: space-between; }
      .stat-label {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: var(--mat-sys-on-surface-variant);
      }
      .stat-icon { font-size: 1.2rem; line-height: 1; }
      .stat-icon.icon-blue {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border-radius: 8px;
        background: color-mix(in srgb, #0ea5e9 16%, transparent);
        color: #0ea5e9;

        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
      .stat-value {
        font-family: 'Inter', sans-serif;
        font-size: 1.7rem;
        font-weight: 700;
        margin-top: 12px;
      }
      .stat-sub {
        font-size: 0.8rem;
        color: var(--mat-sys-on-surface-variant);
        margin-top: 4px;
      }
      .stat-card.highlight {
        background: color-mix(in srgb, var(--mat-sys-primary) 10%, transparent) !important;
      }

      .progress-card { margin-bottom: 20px; }
      .progress-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 10px;
      }
      .progress-title { font-weight: 600; }
      .progress-amounts { font-size: 0.85rem; color: var(--mat-sys-on-surface-variant); }
      .progress-percent { text-align: right; }
      .progress-percent-value {
        font-family: 'Inter', sans-serif;
        font-size: 1.3rem;
        font-weight: 700;
        color: var(--accent-ink);
      }
      .progress-percent-label {
        font-size: 0.72rem;
        color: var(--mat-sys-on-surface-variant);
      }

      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; }

      .card-head { display: flex; align-items: flex-start; margin-bottom: 16px; }
      .card-title { font-weight: 700; font-size: 1.05rem; }
      .card-subtitle {
        font-size: 0.85rem;
        color: var(--mat-sys-on-surface-variant);
        margin-top: 2px;
      }
      .card-total { text-align: right; }
      .card-total-label {
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: var(--mat-sys-on-surface-variant);
      }
      .card-total-value {
        font-family: 'Inter', sans-serif;
        font-weight: 700;
        font-size: 1.25rem;
        color: var(--accent-ink);
        margin-top: 2px;
      }

      .add-box {
        background: var(--hover-bg);
        border-radius: 14px;
        padding: 18px;
        margin-bottom: 18px;
        box-sizing: border-box;
      }
      .add-box > .field-label { display: block; margin-bottom: 10px; }
      .field-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--mat-sys-on-surface-variant);
      }
      .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
      .field:last-of-type { margin-bottom: 0; }

      .add-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
      .add-row > .plain-input { flex: 1 1 auto; }

      .plain-input {
        width: 100%;
        height: 44px;
        padding: 0 14px;
        border-radius: 10px;
        border: 1px solid var(--field-border);
        background: var(--field-bg);
        color: inherit;
        font-family: 'Inter', sans-serif;
        font-size: 0.92rem;
        box-sizing: border-box;
        outline: none;
        transition: border-color 150ms ease;
      }
      .plain-input::placeholder { color: var(--ink-faint); }
      .plain-input:focus { border-color: var(--mat-sys-primary); }
      .plain-input.has-suffix { padding-right: 40px; cursor: pointer; }

      .plain-input-wrap { position: relative; display: flex; align-items: center; }
      .plain-input-wrap.amount { width: 140px; flex: 0 0 auto; }
      .plain-input-wrap .prefix {
        position: absolute;
        left: 14px;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.9rem;
        pointer-events: none;
      }
      .plain-input-wrap .prefix + .plain-input { padding-left: 28px; }
      .plain-input-wrap .suffix-icon {
        position: absolute;
        right: -4px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--mat-sys-on-surface-variant);
      }

      .action-btn {
        background: var(--accent-grad);
        color: var(--on-accent);
        border: none;
        border-radius: 10px;
        padding: 0 20px;
        height: 44px;
        font-weight: 600;
        font-size: 0.92rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
        white-space: nowrap;
        box-shadow:
          0 4px 14px oklch(0.6 0.15 168 / 0.35),
          0 6px 14px rgba(16, 185, 129, 0.35);
        transition: transform 90ms ease, box-shadow 90ms ease;
      }
      .action-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
      .action-btn:active {
        transform: translateY(3px);
        box-shadow:
          0 1px 6px oklch(0.6 0.15 168 / 0.3),
          0 2px 6px rgba(16, 185, 129, 0.3);
      }
      .action-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        box-shadow: none;
      }
      .action-btn.full-width { width: 100%; margin-top: 4px; }

      .dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--accent);
        margin-right: 10px;
        vertical-align: middle;
      }

      .mat-mdc-header-cell {
        text-transform: uppercase;
        font-size: 0.72rem;
        letter-spacing: 0.04em;
      }

      .table-total {
        display: flex;
        justify-content: space-between;
        padding: 12px 16px;
        margin-top: 4px;
        font-weight: 600;
        border-top: 1px solid var(--hairline);
      }
    `,
  ],
})
export class BudgetsComponent {
  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);

  readonly itemColumns = ['name', 'amount', 'actions'];
  readonly budgetColumns = ['month', 'salary'];
  readonly items = signal<BudgetItem[]>([]);
  readonly budgets = signal<MonthlyBudget[]>([]);

  readonly itemsTotal = computed(() =>
    this.items().reduce((sum, i) => sum + Number(i.amount), 0),
  );

  readonly latestBudget = computed<MonthlyBudget | null>(() => {
    const list = this.budgets();
    if (!list.length) return null;
    return [...list].sort((a, b) => b.month.localeCompare(a.month))[0];
  });

  readonly monthlySalary = computed(() => Number(this.latestBudget()?.salary ?? 0));

  readonly freeToSpend = computed(() => this.monthlySalary() - this.itemsTotal());

  readonly committedPercent = computed(() => {
    const salary = this.monthlySalary();
    if (!salary) return 0;
    return Math.min(Math.max(Math.round((this.itemsTotal() / salary) * 100), 0), 100);
  });

  readonly freePercent = computed(() => 100 - this.committedPercent());

  newName = '';
  newAmount: number | null = null;
  newMonth: Date | null = new Date();
  newSalary: number | null = null;

  constructor() {
    this.loadItems();
    this.loadBudgets();
  }

  private loadItems() {
    this.api.listBudgetItems().subscribe((r) => this.items.set(r));
  }
  private loadBudgets() {
    this.api.listMonthlyBudgets().subscribe((r) => this.budgets.set(r));
  }

  addItem() {
    this.api
      .createBudgetItem({ name: this.newName, amount: Number(this.newAmount ?? 0) })
      .subscribe(() => {
        this.newName = '';
        this.newAmount = null;
        this.loadItems();
      });
  }

  removeItem(i: BudgetItem) {
    this.api.deleteBudgetItem(i.id).subscribe(() => this.loadItems());
  }

  saveSalary() {
    if (!this.newMonth) return;
    const first = new Date(this.newMonth.getFullYear(), this.newMonth.getMonth(), 1);
    const month = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-01`;
    this.api
      .upsertMonthlyBudget({ month, salary: Number(this.newSalary ?? 0) })
      .subscribe({
        next: () => {
          this.snack.open('Salary saved', 'OK', { duration: 2000 });
          this.newSalary = null;
          this.loadBudgets();
        },
        error: () => this.snack.open('Save failed', 'OK', { duration: 3000 }),
      });
  }
}
