import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
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
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
  ],
  template: `
    <div class="page">
      <div class="page-header"><h1>Budget</h1></div>

      <div class="grid">
        <mat-card>
          <mat-card-header>
            <mat-card-title>Recurring monthly items</mat-card-title>
            <mat-card-subtitle>Total: {{ itemsTotal() | currency: 'INR' : 'symbol' : '1.0-0' }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="add-row">
              <mat-form-field appearance="outline">
                <mat-label>Name</mat-label>
                <input matInput [(ngModel)]="newName" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="amount">
                <mat-label>Amount</mat-label>
                <input matInput type="number" [(ngModel)]="newAmount" />
              </mat-form-field>
              <button matButton="filled" (click)="addItem()" [disabled]="!newName">
                <mat-icon>add</mat-icon>
              </button>
            </div>

            <table mat-table [dataSource]="items()" class="full-width">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Name</th>
                <td mat-cell *matCellDef="let i">{{ i.name }}</td>
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
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header>
            <mat-card-title>Monthly salary</mat-card-title>
            <mat-card-subtitle>Used for salary-vs-usage on the dashboard</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="add-row">
              <mat-form-field appearance="outline">
                <mat-label>Month</mat-label>
                <input matInput [matDatepicker]="picker" [(ngModel)]="newMonth" />
                <mat-datepicker-toggle matIconSuffix [for]="picker" />
                <mat-datepicker #picker startView="multi-year" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="amount">
                <mat-label>Salary</mat-label>
                <input matInput type="number" [(ngModel)]="newSalary" />
              </mat-form-field>
              <button matButton="filled" (click)="saveSalary()" [disabled]="!newMonth">
                <mat-icon>save</mat-icon>
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
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; }
      .add-row { display: flex; gap: 12px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
      .add-row .amount { width: 140px; }
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
