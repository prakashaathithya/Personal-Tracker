import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
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
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 16px;
      }
      .charts .wide { grid-column: 1 / -1; }
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
  readonly monthlyRows = signal<MonthlyReportRow[]>([]);
  readonly netWorthSeries = signal<NetWorthPoint[]>([]);

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
      monthly: this.api.monthly(this.selectedYear()),
      balances: this.api.accountBalances(),
      trend: this.api.netWorthTrend(),
    }).subscribe({
      next: (r) => {
        this.summary.set(r.summary);
        this.byCategory.set(r.byCategory);
        this.byNeedClass.set(r.byNeedClass);
        this.monthlyRows.set(r.monthly);
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

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
