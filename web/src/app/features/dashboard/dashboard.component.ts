import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ChartConfiguration } from 'chart.js';
import { ApiService } from '../../core/api.service';
import {
  CategoryTotal,
  MonthlyReportRow,
  NeedClassTotal,
  Summary,
} from '../../core/models';
import { ChartComponent } from '../../shared/chart.component';

const PALETTE = [
  '#1976d2', '#26a69a', '#ef5350', '#ab47bc', '#ffa726',
  '#66bb6a', '#42a5f5', '#ec407a', '#8d6e63', '#78909c',
];

@Component({
  selector: 'app-dashboard',
  imports: [
    CurrencyPipe,
    MatCardModule,
    MatProgressBarModule,
    MatButtonToggleModule,
    ChartComponent,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Dashboard</h1>
        <span class="spacer"></span>
        <mat-button-toggle-group [value]="range()" (change)="setRange($event.value)" hideSingleSelectionIndicator>
          <mat-button-toggle value="month">This month</mat-button-toggle>
          <mat-button-toggle value="year">This year</mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      <div class="cards-row">
        <mat-card>
          <mat-card-content>
            <div class="label">Total spent</div>
            <div class="value">{{ summary().total | currency: 'INR' : 'symbol' : '1.0-0' }}</div>
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-content>
            <div class="label">Planned</div>
            <div class="value">{{ summary().planned | currency: 'INR' : 'symbol' : '1.0-0' }}</div>
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-content>
            <div class="label">Unplanned</div>
            <div class="value amount-negative">{{ summary().unplanned | currency: 'INR' : 'symbol' : '1.0-0' }}</div>
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-content>
            <div class="label">Transactions</div>
            <div class="value">{{ summary().count }}</div>
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
        <mat-card class="wide">
          <mat-card-header><mat-card-title>Salary vs Usage ({{ year }})</mat-card-title></mat-card-header>
          <mat-card-content>
            <app-chart [config]="monthlyChart()" />
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      .label { font-size: 0.85rem; opacity: 0.7; }
      .value { font-size: 1.5rem; font-weight: 600; margin-top: 4px; }
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
  readonly summary = signal<Summary>({ total: 0, planned: 0, unplanned: 0, count: 0 });
  readonly byCategory = signal<CategoryTotal[]>([]);
  readonly byNeedClass = signal<NeedClassTotal[]>([]);
  readonly monthlyRows = signal<MonthlyReportRow[]>([]);
  readonly year = new Date().getFullYear();

  constructor() {
    this.load();
  }

  setRange(value: 'month' | 'year') {
    this.range.set(value);
    this.load();
  }

  private bounds(): { from: string; to: string } {
    const now = new Date();
    if (this.range() === 'year') {
      return { from: `${this.year}-01-01`, to: `${this.year}-12-31` };
    }
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: iso(first), to: iso(now) };
  }

  private load() {
    const { from, to } = this.bounds();
    this.loading.set(true);
    forkJoin({
      summary: this.api.summary(from, to),
      byCategory: this.api.byCategory(from, to),
      byNeedClass: this.api.byNeedClass(from, to),
      monthly: this.api.monthly(this.year),
    }).subscribe({
      next: (r) => {
        this.summary.set(r.summary);
        this.byCategory.set(r.byCategory);
        this.byNeedClass.set(r.byNeedClass);
        this.monthlyRows.set(r.monthly);
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

  readonly monthlyChart = computed<ChartConfiguration>(() => {
    const rows = this.monthlyRows();
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Salary', data: rows.map((r) => r.salary), backgroundColor: '#26a69a' },
          { label: 'Usage', data: rows.map((r) => r.usage), backgroundColor: '#ef5350' },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    };
  });
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
