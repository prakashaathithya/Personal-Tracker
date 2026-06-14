import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/api.service';
import { Loan } from '../../core/models';

@Component({
  selector: 'app-loans',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    MatCardModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatListModule,
  ],
  template: `
    <div class="page">
      <div class="page-header"><h1>Loans / EMI</h1></div>

      <div class="grid">
        <div>
          <mat-card>
            <mat-card-header><mat-card-title>Your loans</mat-card-title></mat-card-header>
            <mat-card-content>
              @if (loans().length === 0) {
                <p class="empty">No loans yet.</p>
              }
              <mat-nav-list>
                @for (l of loans(); track l.id) {
                  <a mat-list-item (click)="select(l)" [activated]="selected()?.id === l.id">
                    <span matListItemTitle>{{ l.name }}</span>
                    <span matListItemLine>{{ l.principal | currency: 'INR' : 'symbol' : '1.0-0' }}</span>
                    <button matIconButton matListItemMeta (click)="remove(l, $event)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </a>
                }
              </mat-nav-list>
            </mat-card-content>
          </mat-card>

          <mat-card class="mt">
            <mat-card-header><mat-card-title>Add loan</mat-card-title></mat-card-header>
            <mat-card-content>
              <form [formGroup]="form" (ngSubmit)="add()" class="form">
                <mat-form-field class="full-width">
                  <mat-label>Name</mat-label>
                  <input matInput formControlName="name" />
                </mat-form-field>
                <mat-form-field class="full-width">
                  <mat-label>Principal</mat-label>
                  <input matInput type="number" formControlName="principal" />
                </mat-form-field>
                <mat-form-field class="full-width">
                  <mat-label>Annual interest rate (%)</mat-label>
                  <input matInput type="number" formControlName="annual_rate" />
                </mat-form-field>
                <mat-form-field class="full-width">
                  <mat-label>Monthly EMI</mat-label>
                  <input matInput type="number" formControlName="emi_amount" />
                </mat-form-field>
                <mat-form-field class="full-width">
                  <mat-label>Start date</mat-label>
                  <input matInput [matDatepicker]="picker" formControlName="start_date" />
                  <mat-datepicker-toggle matIconSuffix [for]="picker" />
                  <mat-datepicker #picker />
                </mat-form-field>
                <button matButton="filled" type="submit" [disabled]="form.invalid">
                  Add & generate schedule
                </button>
              </form>
            </mat-card-content>
          </mat-card>
        </div>

        <mat-card>
          <mat-card-header>
            <mat-card-title>{{ selected()?.name ?? 'Schedule' }}</mat-card-title>
            @if (selected()) {
              <mat-card-subtitle>{{ selected()!.schedule?.length ?? 0 }} installments</mat-card-subtitle>
            }
          </mat-card-header>
          <mat-card-content>
            @if (!selected()) {
              <p class="empty">Select a loan to view its amortization schedule.</p>
            } @else {
              <table mat-table [dataSource]="selected()!.schedule ?? []" class="full-width">
                <ng-container matColumnDef="period">
                  <th mat-header-cell *matHeaderCellDef>#</th>
                  <td mat-cell *matCellDef="let r">{{ r.period }}</td>
                </ng-container>
                <ng-container matColumnDef="due_date">
                  <th mat-header-cell *matHeaderCellDef>Due</th>
                  <td mat-cell *matCellDef="let r">{{ r.due_date | date: 'MMM yyyy' }}</td>
                </ng-container>
                <ng-container matColumnDef="emi">
                  <th mat-header-cell *matHeaderCellDef class="text-right">EMI</th>
                  <td mat-cell *matCellDef="let r" class="text-right">{{ r.emi | currency: 'INR' : 'symbol' : '1.0-0' }}</td>
                </ng-container>
                <ng-container matColumnDef="interest">
                  <th mat-header-cell *matHeaderCellDef class="text-right">Interest</th>
                  <td mat-cell *matCellDef="let r" class="text-right">{{ r.interest | currency: 'INR' : 'symbol' : '1.0-0' }}</td>
                </ng-container>
                <ng-container matColumnDef="principal_paid">
                  <th mat-header-cell *matHeaderCellDef class="text-right">Principal</th>
                  <td mat-cell *matCellDef="let r" class="text-right">{{ r.principal_paid | currency: 'INR' : 'symbol' : '1.0-0' }}</td>
                </ng-container>
                <ng-container matColumnDef="balance">
                  <th mat-header-cell *matHeaderCellDef class="text-right">Balance</th>
                  <td mat-cell *matCellDef="let r" class="text-right">{{ r.balance | currency: 'INR' : 'symbol' : '1.0-0' }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="scheduleColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: scheduleColumns"></tr>
              </table>
            }
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      .grid { display: grid; grid-template-columns: 360px 1fr; gap: 16px; align-items: start; }
      @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }
      .form { display: flex; flex-direction: column; gap: 4px; }
      .mt { margin-top: 16px; }
      .empty { opacity: 0.6; padding: 16px; }
    `,
  ],
})
export class LoansComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(MatSnackBar);

  readonly scheduleColumns = ['period', 'due_date', 'emi', 'interest', 'principal_paid', 'balance'];
  readonly loans = signal<Loan[]>([]);
  readonly selected = signal<Loan | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    principal: [0, [Validators.required, Validators.min(0)]],
    annual_rate: [0, [Validators.min(0)]],
    emi_amount: [0, [Validators.min(0)]],
    start_date: [new Date(), Validators.required],
  });

  constructor() {
    this.loadLoans();
  }

  private loadLoans() {
    this.api.listLoans().subscribe((r) => this.loans.set(r));
  }

  select(loan: Loan) {
    this.api.getLoan(loan.id).subscribe((full) => this.selected.set(full));
  }

  add() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.api
      .createLoan({
        name: v.name,
        principal: Number(v.principal),
        annual_rate: v.annual_rate ? Number(v.annual_rate) : undefined,
        emi_amount: v.emi_amount ? Number(v.emi_amount) : undefined,
        start_date: v.start_date
          ? new Date(v.start_date.getTime() - v.start_date.getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 10)
          : undefined,
      })
      .subscribe({
        next: (loan) => {
          this.snack.open('Loan added', 'OK', { duration: 2000 });
          this.form.reset({ name: '', principal: 0, annual_rate: 0, emi_amount: 0, start_date: new Date() });
          this.loadLoans();
          this.selected.set(loan);
        },
        error: (err) => this.snack.open(err?.error?.message ?? 'Failed', 'OK', { duration: 4000 }),
      });
  }

  remove(loan: Loan, event: Event) {
    event.stopPropagation();
    if (!confirm(`Delete loan "${loan.name}"?`)) return;
    this.api.deleteLoan(loan.id).subscribe(() => {
      if (this.selected()?.id === loan.id) this.selected.set(null);
      this.loadLoans();
    });
  }
}
