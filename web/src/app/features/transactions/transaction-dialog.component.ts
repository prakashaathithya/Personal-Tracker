import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { Category, PaymentType, Transaction } from '../../core/models';

export interface TxnDialogData {
  categories: Category[];
  paymentTypes: PaymentType[];
  transaction?: Transaction;
}

@Component({
  selector: 'app-transaction-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatSlideToggleModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.transaction ? 'Edit' : 'Add' }} transaction</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field class="full-width">
          <mat-label>Date</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="txn_date" />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>Description</mat-label>
          <input matInput formControlName="description" />
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>Amount</mat-label>
          <input matInput type="number" formControlName="amount" />
          <span matTextPrefix>₹&nbsp;</span>
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>Category</mat-label>
          <mat-select formControlName="category_id">
            <mat-option [value]="null">— none —</mat-option>
            @for (c of data.categories; track c.id) {
              <mat-option [value]="c.id">{{ c.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>Payment type</mat-label>
          <mat-select formControlName="payment_type_id">
            <mat-option [value]="null">— none —</mat-option>
            @for (p of data.paymentTypes; track p.id) {
              <mat-option [value]="p.id">{{ p.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-slide-toggle formControlName="planned">Planned expense</mat-slide-toggle>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>Cancel</button>
      <button matButton="filled" [disabled]="form.invalid" (click)="save()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`.form { display: flex; flex-direction: column; gap: 8px; min-width: 320px; padding-top: 8px; }`],
})
export class TransactionDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly ref = inject(MatDialogRef<TransactionDialogComponent>);
  readonly data = inject<TxnDialogData>(MAT_DIALOG_DATA);

  readonly form = this.fb.nonNullable.group({
    txn_date: [
      this.data.transaction ? new Date(this.data.transaction.txn_date) : new Date(),
      Validators.required,
    ],
    description: [this.data.transaction?.description ?? '', Validators.required],
    amount: [this.data.transaction?.amount ?? 0, [Validators.required, Validators.min(0)]],
    category_id: [this.data.transaction?.category_id ?? (null as string | null)],
    payment_type_id: [this.data.transaction?.payment_type_id ?? (null as string | null)],
    planned: [this.data.transaction?.planned ?? false],
  });

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.ref.close({
      txn_date: toIso(v.txn_date),
      description: v.description,
      amount: Number(v.amount),
      category_id: v.category_id || undefined,
      payment_type_id: v.payment_type_id || undefined,
      planned: v.planned,
    });
  }
}

function toIso(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
