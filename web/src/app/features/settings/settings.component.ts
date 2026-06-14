import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/api.service';
import { Category, NeedClass, PaymentType } from '../../core/models';

@Component({
  selector: 'app-settings',
  imports: [
    FormsModule,
    MatCardModule,
    MatListModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <div class="page">
      <div class="page-header"><h1>Settings</h1></div>

      <div class="grid">
        <mat-card>
          <mat-card-header><mat-card-title>Categories</mat-card-title></mat-card-header>
          <mat-card-content>
            <div class="add-row">
              <mat-form-field appearance="outline">
                <mat-label>New category</mat-label>
                <input matInput [(ngModel)]="newCat" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Class</mat-label>
                <mat-select [(ngModel)]="newCatClass">
                  @for (nc of needClasses; track nc) {
                    <mat-option [value]="nc">{{ nc }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <button matButton="filled" (click)="addCategory()" [disabled]="!newCat"><mat-icon>add</mat-icon></button>
            </div>
            <mat-list>
              @for (c of categories(); track c.id) {
                <mat-list-item>
                  <span matListItemTitle>{{ c.name }}</span>
                  <span matListItemLine>{{ c.need_class }}</span>
                  <button matIconButton matListItemMeta (click)="deleteCategory(c)"><mat-icon>delete</mat-icon></button>
                </mat-list-item>
              }
            </mat-list>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header><mat-card-title>Payment types</mat-card-title></mat-card-header>
          <mat-card-content>
            <div class="add-row">
              <mat-form-field appearance="outline">
                <mat-label>New payment type</mat-label>
                <input matInput [(ngModel)]="newPay" />
              </mat-form-field>
              <button matButton="filled" (click)="addPayment()" [disabled]="!newPay"><mat-icon>add</mat-icon></button>
            </div>
            <mat-list>
              @for (p of paymentTypes(); track p.id) {
                <mat-list-item>
                  <span matListItemTitle>{{ p.name }}</span>
                  <button matIconButton matListItemMeta (click)="deletePayment(p)"><mat-icon>delete</mat-icon></button>
                </mat-list-item>
              }
            </mat-list>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; }
      .add-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    `,
  ],
})
export class SettingsComponent {
  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);

  readonly needClasses: NeedClass[] = ['Needs', 'Wants', 'Saving', 'Others'];
  readonly categories = signal<Category[]>([]);
  readonly paymentTypes = signal<PaymentType[]>([]);

  newCat = '';
  newCatClass: NeedClass = 'Others';
  newPay = '';

  constructor() {
    this.loadCategories();
    this.loadPayments();
  }

  private loadCategories() {
    this.api.listCategories().subscribe((r) => this.categories.set(r));
  }
  private loadPayments() {
    this.api.listPaymentTypes().subscribe((r) => this.paymentTypes.set(r));
  }

  addCategory() {
    this.api
      .createCategory({ name: this.newCat, need_class: this.newCatClass })
      .subscribe({
        next: () => {
          this.newCat = '';
          this.loadCategories();
        },
        error: (err) => this.snack.open(err?.error?.message ?? 'Failed', 'OK', { duration: 3000 }),
      });
  }
  deleteCategory(c: Category) {
    this.api.deleteCategory(c.id).subscribe(() => this.loadCategories());
  }

  addPayment() {
    this.api.createPaymentType({ name: this.newPay }).subscribe({
      next: () => {
        this.newPay = '';
        this.loadPayments();
      },
      error: (err) => this.snack.open(err?.error?.message ?? 'Failed', 'OK', { duration: 3000 }),
    });
  }
  deletePayment(p: PaymentType) {
    this.api.deletePaymentType(p.id).subscribe(() => this.loadPayments());
  }
}
