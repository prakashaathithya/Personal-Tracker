import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ChartConfiguration } from 'chart.js';
import { ApiService } from '../../core/api.service';
import {
  CategoryTotal,
  MonthlyReportRow,
  NeedClassTotal,
  NetWorthPoint,
  PaymentTypeTotal,
  ReportMatrix,
  Summary,
} from '../../core/models';
import { ChartComponent } from '../../shared/chart.component';

// Glass dashboard palette — teal-led aurora hues from the design
const PALETTE = [
  '#34d09b', '#3fb6c9', '#5a9bf6', '#55d669', '#9ee04f',
  '#4f8ef7', '#f2a24a', '#f06ec0', '#a678e6', '#8a8f9c',
];
const TEAL = '#34d09b';
const BLUE = '#5a9bf6';
const RED = '#ef6a5f';

@Component({
  selector: 'app-dashboard',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    PercentPipe,
    MatCardModule,
    MatProgressBarModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatSelectModule,
    ChartComponent,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Dashboard</h1>
        <span class="spacer"></span>
        <div class="filters">
          <mat-button-toggle-group [value]="range()" (change)="setRange($event.value)" hideSingleSelectionIndicator>
            <mat-button-toggle value="month">Month</mat-button-toggle>
            <mat-button-toggle value="year">Year</mat-button-toggle>
          </mat-button-toggle-group>

          @if (range() === 'month') {
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="picker">
              <mat-select [value]="selectedMonth()" (valueChange)="setMonth($event)">
                @for (m of months; track m.value) {
                  <mat-option [value]="m.value">{{ m.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          }

          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="picker">
            <mat-select [value]="selectedYear()" (valueChange)="setYear($event)">
              @for (y of years; track y) {
                <mat-option [value]="y">{{ y }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      <div class="cards-row">
        <mat-card class="highlight">
          <mat-card-content>
            <div class="label">Net worth</div>
            <div class="value pos">{{ netWorth() | currency: 'INR' : 'symbol' : '1.0-0' }}</div>
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-content>
            <div class="label">Income</div>
            <div class="value pos">{{ summary().income | currency: 'INR' : 'symbol' : '1.0-0' }}</div>
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-content>
            <div class="label">Expenses</div>
            <div class="value">{{ summary().expense | currency: 'INR' : 'symbol' : '1.0-0' }}</div>
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-content>
            <div class="label">Net (saved)</div>
            <div class="value" [class.pos]="summary().net >= 0" [class.neg]="summary().net < 0">
              {{ summary().net | currency: 'INR' : 'symbol' : '1.0-0' }}
            </div>
            <div class="sub">{{ savingsRate() | percent: '1.0-1' }} of income</div>
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-content>
            <div class="label">Planned</div>
            <div class="value">{{ summary().planned | currency: 'INR' : 'symbol' : '1.0-0' }}</div>
            <div class="sub">{{ plannedShare() | percent: '1.0-1' }} of spend</div>
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-content>
            <div class="label">Un-planned</div>
            <div class="value neg">{{ summary().unplanned | currency: 'INR' : 'symbol' : '1.0-0' }}</div>
            <div class="sub">{{ summary().count }} transactions</div>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="charts">
        <mat-card>
          <mat-card-header><mat-card-title>Spend by category</mat-card-title></mat-card-header>
          <mat-card-content>
            <app-chart [config]="categoryChart()" />
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-header><mat-card-title>Needs vs Wants vs Saving</mat-card-title></mat-card-header>
          <mat-card-content>
            <app-chart [config]="needClassChart()" />
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-header><mat-card-title>Salary vs Spends ({{ selectedYear() }})</mat-card-title></mat-card-header>
          <mat-card-content>
            <app-chart [config]="salaryVsSpendChart()" />
          </mat-card-content>
        </mat-card>
        <mat-card class="wide">
          <mat-card-header><mat-card-title>Salary vs Usage ({{ selectedYear() }})</mat-card-title></mat-card-header>
          <mat-card-content>
            <app-chart [config]="monthlyChart()" />
          </mat-card-content>
        </mat-card>
        <mat-card class="wide">
          <mat-card-header><mat-card-title>Net worth over time</mat-card-title></mat-card-header>
          <mat-card-content>
            <app-chart [config]="netWorthChart()" />
          </mat-card-content>
        </mat-card>
      </div>

      <div class="tables">
        <mat-card>
          <mat-card-header>
            <mat-card-title>Spend by category</mat-card-title>
            <span class="hint">{{ rangeLabel() }}</span>
          </mat-card-header>
          <mat-card-content class="scroll-x">
            <table class="grid">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Class</th>
                  <th class="num">Txns</th>
                  <th class="num">Planned</th>
                  <th class="num">Un-planned</th>
                  <th class="num">Total</th>
                  <th class="num">Share</th>
                </tr>
              </thead>
              <tbody>
                @for (c of byCategory(); track c.category) {
                  <tr>
                    <td>{{ c.category }}</td>
                    <td><span class="badge">{{ c.need_class }}</span></td>
                    <td class="num">{{ c.count }}</td>
                    <td class="num">{{ c.planned | number: '1.0-0' }}</td>
                    <td class="num">{{ c.unplanned | number: '1.0-0' }}</td>
                    <td class="num strong">{{ c.total | number: '1.0-0' }}</td>
                    <td class="num">
                      <span class="share">
                        <span class="share-bar" [style.width.%]="pct(c.total, summary().expense)"></span>
                        <span class="share-text">{{ pct(c.total, summary().expense) | number: '1.0-1' }}%</span>
                      </span>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="empty">No spend in this period.</td></tr>
                }
              </tbody>
              @if (byCategory().length) {
                <tfoot>
                  <tr>
                    <td colspan="2">Total</td>
                    <td class="num">{{ summary().count }}</td>
                    <td class="num">{{ summary().planned | number: '1.0-0' }}</td>
                    <td class="num">{{ summary().unplanned | number: '1.0-0' }}</td>
                    <td class="num strong">{{ summary().expense | number: '1.0-0' }}</td>
                    <td class="num">100%</td>
                  </tr>
                </tfoot>
              }
            </table>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header>
            <mat-card-title>Spend by payment type</mat-card-title>
            <span class="hint">{{ rangeLabel() }}</span>
          </mat-card-header>
          <mat-card-content class="scroll-x">
            <table class="grid">
              <thead>
                <tr>
                  <th>Payment type</th>
                  <th class="num">Txns</th>
                  <th class="num">Total</th>
                  <th class="num">Share</th>
                </tr>
              </thead>
              <tbody>
                @for (p of byPaymentType(); track p.payment_type) {
                  <tr>
                    <td>{{ p.payment_type }}</td>
                    <td class="num">{{ p.count }}</td>
                    <td class="num strong">{{ p.total | number: '1.0-0' }}</td>
                    <td class="num">
                      <span class="share">
                        <span class="share-bar" [style.width.%]="pct(p.total, summary().expense)"></span>
                        <span class="share-text">{{ pct(p.total, summary().expense) | number: '1.0-1' }}%</span>
                      </span>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="empty">No spend in this period.</td></tr>
                }
              </tbody>
            </table>
          </mat-card-content>
        </mat-card>

        <mat-card class="wide">
          <mat-card-header>
            <mat-card-title>Monthly summary ({{ selectedYear() }})</mat-card-title>
          </mat-card-header>
          <mat-card-content class="scroll-x">
            <table class="grid">
              <thead>
                <tr>
                  <th>Month</th>
                  <th class="num">Salary</th>
                  <th class="num">Usage</th>
                  <th class="num">Balance</th>
                  <th class="num">Saved %</th>
                </tr>
              </thead>
              <tbody>
                @for (r of monthlyRows(); track r.month) {
                  <tr [class.dim]="!r.salary && !r.usage">
                    <td>{{ months[r.month - 1].label }}</td>
                    <td class="num">{{ r.salary | number: '1.0-0' }}</td>
                    <td class="num">{{ r.usage | number: '1.0-0' }}</td>
                    <td class="num strong" [class.neg]="r.balance < 0">{{ r.balance | number: '1.0-0' }}</td>
                    <td class="num">{{ pct(r.balance, r.salary) | number: '1.0-1' }}%</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td class="num">{{ yearTotals().salary | number: '1.0-0' }}</td>
                  <td class="num">{{ yearTotals().usage | number: '1.0-0' }}</td>
                  <td class="num strong" [class.neg]="yearTotals().balance < 0">
                    {{ yearTotals().balance | number: '1.0-0' }}
                  </td>
                  <td class="num">
                    {{ pct(yearTotals().balance, yearTotals().salary) | number: '1.0-1' }}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </mat-card-content>
        </mat-card>

        <mat-card class="wide">
          <mat-card-header>
            <mat-card-title>Month-wise breakdown ({{ selectedYear() }})</mat-card-title>
            <span class="spacer"></span>
            <mat-button-toggle-group
              [value]="matrixDim()"
              (change)="setMatrixDim($event.value)"
              hideSingleSelectionIndicator
            >
              <mat-button-toggle value="category">Category</mat-button-toggle>
              <mat-button-toggle value="payment_type">Payment type</mat-button-toggle>
              <mat-button-toggle value="need_class">Needs/Wants</mat-button-toggle>
            </mat-button-toggle-group>
          </mat-card-header>
          <mat-card-content class="scroll-x">
            <table class="grid pivot">
              <thead>
                <tr>
                  <th class="sticky-col">Month</th>
                  @for (c of matrix().columns; track c) {
                    <th class="num">{{ c }}</th>
                  }
                  <th class="num">Total</th>
                </tr>
              </thead>
              <tbody>
                @for (r of matrix().rows; track r.month) {
                  <tr [class.dim]="!r.total">
                    <td class="sticky-col">{{ months[r.month - 1].label.slice(0, 3) }}</td>
                    @for (v of r.values; track $index) {
                      <td class="num" [class.zero]="!v">{{ v ? (v | number: '1.0-0') : '—' }}</td>
                    }
                    <td class="num strong">{{ r.total | number: '1.0-0' }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td class="sticky-col">Total</td>
                  @for (t of matrix().columnTotals; track $index) {
                    <td class="num">{{ t | number: '1.0-0' }}</td>
                  }
                  <td class="num strong">{{ matrix().grandTotal | number: '1.0-0' }}</td>
                </tr>
              </tfoot>
            </table>
            @if (!matrix().columns.length) {
              <p class="empty">No spend recorded for {{ selectedYear() }}.</p>
            }
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      .filters { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .filters .picker { width: 130px; }
      .filters .picker ::ng-deep .mat-mdc-text-field-wrapper { height: 40px; }
      .filters .picker ::ng-deep .mat-mdc-form-field-infix {
        min-height: 40px;
        padding-top: 8px;
        padding-bottom: 8px;
      }
      .filters .picker ::ng-deep .mat-mdc-form-field-flex { align-items: center; }
      .label { font-size: 0.85rem; font-weight: 500; color: var(--ink-soft); }
      .value {
        font-size: 1.65rem;
        font-weight: 800;
        letter-spacing: -0.01em;
        margin-top: 8px;
        color: var(--ink);
      }
      .value.pos { color: var(--accent-bright); }
      .value.neg { color: var(--danger); }
      .charts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
        gap: 16px;
      }
      .charts .wide { grid-column: 1 / -1; }
      .sub { font-size: 0.75rem; color: var(--ink-faint); margin-top: 4px; }

      .tables {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin-top: 16px;
      }
      .tables .wide { grid-column: 1 / -1; }
      .tables .hint { font-size: 0.75rem; color: var(--ink-faint); margin-left: 10px; }
      .tables mat-card-header { align-items: center; }
      .scroll-x { overflow-x: auto; }

      table.grid {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
        font-variant-numeric: tabular-nums;
      }
      table.grid th,
      table.grid td {
        padding: 8px 12px;
        text-align: left;
        white-space: nowrap;
        border-bottom: 1px solid var(--hairline);
      }
      table.grid thead th {
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-faint);
      }
      table.grid tbody td { color: var(--ink-soft); }
      table.grid tbody tr:hover { background: var(--hover-bg); }
      table.grid tfoot td {
        font-weight: 700;
        color: var(--ink);
        border-top: 1px solid var(--glass-border);
        border-bottom: none;
      }
      table.grid .num { text-align: right; }
      table.grid .strong { color: var(--ink); font-weight: 600; }
      table.grid .neg { color: var(--danger); }
      table.grid .zero { color: var(--ink-faint); }
      table.grid tr.dim td { opacity: 0.45; }
      table.grid .empty { text-align: center; color: var(--ink-faint); padding: 20px; }

      /* Pivot: keep the month column visible while scrolling sideways */
      table.pivot .sticky-col {
        position: sticky;
        left: 0;
        background: var(--glass-bg-strong);
        backdrop-filter: blur(8px);
      }

      .badge {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 600;
        background: var(--surface-2);
        border: 1px solid var(--hairline);
        color: var(--ink-soft);
      }

      .share { display: inline-flex; align-items: center; gap: 8px; justify-content: flex-end; }
      .share-bar {
        display: block;
        height: 6px;
        min-width: 2px;
        max-width: 70px;
        border-radius: 3px;
        background: var(--accent);
      }
      .share-text { min-width: 44px; }

      /* ---- Phone ----
         The report and pivot grids stay real tables — they're genuinely
         two-dimensional data — and scroll sideways inside their card,
         with the first column pinned. Everything around them tightens. */
      @media (max-width: 700px) {
        .filters {
          width: 100%;
          gap: 8px;
        }
        .filters .picker { width: auto; flex: 1 1 110px; }

        .value { font-size: 1.15rem; margin-top: 4px; }
        .label { font-size: 0.72rem; }
        .sub { font-size: 0.68rem; }

        .charts, .tables { gap: 12px; }
        .tables { grid-template-columns: 1fr; }

        /* Give the sideways scroll the full card width instead of
           stopping short at the card's content padding. */
        .scroll-x {
          margin-inline: -16px;
          padding-inline: 16px;
        }

        table.grid { font-size: 0.78rem; }
        table.grid th,
        table.grid td { padding: 7px 9px; }
        .share-bar { max-width: 36px; }
        .share-text { min-width: 36px; }

        /* Sticky column needs an opaque-enough backdrop to hide the
           cells sliding under it. */
        table.pivot .sticky-col {
          background: light-dark(rgba(248, 250, 253, 0.96), rgba(22, 28, 36, 0.96));
        }
      }
    `,
  ],
})
export class DashboardComponent {
  private readonly api = inject(ApiService);

  readonly loading = signal(false);
  readonly range = signal<'month' | 'year'>('month');
  readonly netWorth = signal(0);
  readonly summary = signal<Summary>({
    income: 0,
    expense: 0,
    net: 0,
    total: 0,
    planned: 0,
    unplanned: 0,
    count: 0,
  });
  readonly byCategory = signal<CategoryTotal[]>([]);
  readonly byNeedClass = signal<NeedClassTotal[]>([]);
  readonly byPaymentType = signal<PaymentTypeTotal[]>([]);
  readonly monthlyRows = signal<MonthlyReportRow[]>([]);
  readonly netWorthSeries = signal<NetWorthPoint[]>([]);
  readonly matrixDim = signal<ReportMatrix['dim']>('category');
  readonly matrix = signal<ReportMatrix>(emptyMatrix());

  private readonly currentYear = new Date().getFullYear();
  readonly selectedYear = signal(this.currentYear);
  readonly selectedMonth = signal(new Date().getMonth());

  readonly years = Array.from({ length: 11 }, (_, i) => this.currentYear - i);
  readonly months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ].map((label, value) => ({ label, value }));

  constructor() {
    this.load();
  }

  setRange(value: 'month' | 'year') {
    this.range.set(value);
    this.load();
  }

  setMonth(value: number) {
    this.selectedMonth.set(value);
    this.load();
  }

  setYear(value: number) {
    this.selectedYear.set(value);
    this.load();
  }

  setMatrixDim(value: ReportMatrix['dim']) {
    this.matrixDim.set(value);
    this.api.matrix(this.selectedYear(), value).subscribe({
      next: (m) => this.matrix.set(m),
    });
  }

  /** Percentage of `value` within `total`, guarding a zero denominator. */
  pct(value: number, total: number): number {
    return total ? (value / total) * 100 : 0;
  }

  readonly rangeLabel = computed(() =>
    this.range() === 'year'
      ? String(this.selectedYear())
      : `${this.months[this.selectedMonth()].label} ${this.selectedYear()}`,
  );

  readonly savingsRate = computed(() => {
    const s = this.summary();
    return s.income ? s.net / s.income : 0;
  });

  readonly plannedShare = computed(() => {
    const s = this.summary();
    return s.expense ? s.planned / s.expense : 0;
  });

  readonly yearTotals = computed(() =>
    this.monthlyRows().reduce(
      (acc, r) => ({
        salary: acc.salary + r.salary,
        usage: acc.usage + r.usage,
        balance: acc.balance + r.balance,
      }),
      { salary: 0, usage: 0, balance: 0 },
    ),
  );

  private bounds(): { from: string; to: string } {
    const year = this.selectedYear();
    if (this.range() === 'year') {
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    }
    const month = this.selectedMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    return { from: iso(first), to: iso(last) };
  }

  private load() {
    const { from, to } = this.bounds();
    this.loading.set(true);
    forkJoin({
      summary: this.api.summary(from, to),
      byCategory: this.api.byCategory(from, to),
      byNeedClass: this.api.byNeedClass(from, to),
      byPaymentType: this.api.byPaymentType(from, to),
      monthly: this.api.monthly(this.selectedYear()),
      matrix: this.api.matrix(this.selectedYear(), this.matrixDim()),
      balances: this.api.accountBalances(),
      trend: this.api.netWorthTrend(),
    }).subscribe({
      next: (r) => {
        this.summary.set(r.summary);
        this.byCategory.set(r.byCategory);
        this.byNeedClass.set(r.byNeedClass);
        this.byPaymentType.set(r.byPaymentType);
        this.monthlyRows.set(r.monthly);
        this.matrix.set(r.matrix);
        this.netWorth.set(r.balances.net_worth);
        this.netWorthSeries.set(r.trend);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  readonly categoryChart = computed<ChartConfiguration>(() => {
    const top = this.byCategory().slice(0, 10);
    return {
      type: 'doughnut',
      data: {
        labels: top.map((c) => c.category),
        datasets: [{ data: top.map((c) => c.total), backgroundColor: PALETTE }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } },
    };
  });

  readonly needClassChart = computed<ChartConfiguration>(() => {
    const rows = this.byNeedClass();
    return {
      type: 'pie',
      data: {
        labels: rows.map((r) => r.need_class),
        datasets: [{ data: rows.map((r) => r.total), backgroundColor: PALETTE }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } },
    };
  });

  readonly salaryVsSpendChart = computed<ChartConfiguration>(() => {
    const rows = this.monthlyRows();
    const salary = rows.reduce((sum, r) => sum + r.salary, 0);
    const spends = rows.reduce((sum, r) => sum + r.usage, 0);
    return {
      type: 'pie',
      data: {
        labels: ['Salary', 'Spends'],
        datasets: [{ data: [salary, spends], backgroundColor: [TEAL, RED] }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } },
    };
  });

  readonly netWorthChart = computed<ChartConfiguration>(() => {
    const rows = this.netWorthSeries();
    const fmt = (ym: string) => {
      const [y, m] = ym.split('-').map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      });
    };
    return {
      type: 'line',
      data: {
        labels: rows.map((r) => fmt(r.month)),
        datasets: [
          {
            label: 'Net worth',
            data: rows.map((r) => r.net_worth),
            borderColor: TEAL,
            backgroundColor: 'rgba(52, 208, 155, 0.15)',
            fill: true,
            tension: 0.3,
            pointRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    };
  });

  readonly monthlyChart = computed<ChartConfiguration>(() => {
    const rows = this.monthlyRows();
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Salary', data: rows.map((r) => r.salary), backgroundColor: TEAL, borderRadius: 6 },
          { label: 'Usage', data: rows.map((r) => r.usage), backgroundColor: BLUE, borderRadius: 6 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    };
  });
}

function emptyMatrix(): ReportMatrix {
  return {
    year: new Date().getFullYear(),
    dim: 'category',
    columns: [],
    rows: [],
    columnTotals: [],
    grandTotal: 0,
  };
}

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
