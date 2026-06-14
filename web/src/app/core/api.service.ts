import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  BudgetItem,
  Category,
  CategoryTotal,
  ImportRow,
  Loan,
  MonthlyBudget,
  MonthlyReportRow,
  NeedClassTotal,
  Paged,
  PaymentType,
  Summary,
  Transaction,
} from './models';

export interface TransactionFilter {
  from?: string;
  to?: string;
  category_id?: string;
  payment_type_id?: string;
  planned?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  private params(obj: Record<string, unknown>): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== null && v !== '') {
        p = p.set(k, String(v));
      }
    }
    return p;
  }

  // Categories
  listCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.base}/categories`);
  }
  createCategory(body: Partial<Category>): Observable<Category> {
    return this.http.post<Category>(`${this.base}/categories`, body);
  }
  updateCategory(id: string, body: Partial<Category>): Observable<Category> {
    return this.http.patch<Category>(`${this.base}/categories/${id}`, body);
  }
  deleteCategory(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/categories/${id}`);
  }

  // Payment types
  listPaymentTypes(): Observable<PaymentType[]> {
    return this.http.get<PaymentType[]>(`${this.base}/payment-types`);
  }
  createPaymentType(body: Partial<PaymentType>): Observable<PaymentType> {
    return this.http.post<PaymentType>(`${this.base}/payment-types`, body);
  }
  updatePaymentType(id: string, body: Partial<PaymentType>): Observable<PaymentType> {
    return this.http.patch<PaymentType>(`${this.base}/payment-types/${id}`, body);
  }
  deletePaymentType(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/payment-types/${id}`);
  }

  // Transactions
  listTransactions(filter: TransactionFilter = {}): Observable<Paged<Transaction>> {
    return this.http.get<Paged<Transaction>>(`${this.base}/transactions`, {
      params: this.params(filter as Record<string, unknown>),
    });
  }
  createTransaction(body: Partial<Transaction>): Observable<Transaction> {
    return this.http.post<Transaction>(`${this.base}/transactions`, body);
  }
  updateTransaction(id: string, body: Partial<Transaction>): Observable<Transaction> {
    return this.http.patch<Transaction>(`${this.base}/transactions/${id}`, body);
  }
  deleteTransaction(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/transactions/${id}`);
  }

  // Budgets
  listBudgetItems(): Observable<BudgetItem[]> {
    return this.http.get<BudgetItem[]>(`${this.base}/budget-items`);
  }
  createBudgetItem(body: Partial<BudgetItem>): Observable<BudgetItem> {
    return this.http.post<BudgetItem>(`${this.base}/budget-items`, body);
  }
  updateBudgetItem(id: string, body: Partial<BudgetItem>): Observable<BudgetItem> {
    return this.http.patch<BudgetItem>(`${this.base}/budget-items/${id}`, body);
  }
  deleteBudgetItem(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/budget-items/${id}`);
  }

  listMonthlyBudgets(): Observable<MonthlyBudget[]> {
    return this.http.get<MonthlyBudget[]>(`${this.base}/monthly-budgets`);
  }
  upsertMonthlyBudget(body: { month: string; salary: number }): Observable<MonthlyBudget> {
    return this.http.put<MonthlyBudget>(`${this.base}/monthly-budgets`, body);
  }

  // Loans
  listLoans(): Observable<Loan[]> {
    return this.http.get<Loan[]>(`${this.base}/loans`);
  }
  getLoan(id: string): Observable<Loan> {
    return this.http.get<Loan>(`${this.base}/loans/${id}`);
  }
  createLoan(body: Partial<Loan>): Observable<Loan> {
    return this.http.post<Loan>(`${this.base}/loans`, body);
  }
  deleteLoan(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/loans/${id}`);
  }

  // Reports
  summary(from?: string, to?: string): Observable<Summary> {
    return this.http.get<Summary>(`${this.base}/reports/summary`, {
      params: this.params({ from, to }),
    });
  }
  byCategory(from?: string, to?: string): Observable<CategoryTotal[]> {
    return this.http.get<CategoryTotal[]>(`${this.base}/reports/by-category`, {
      params: this.params({ from, to }),
    });
  }
  byNeedClass(from?: string, to?: string): Observable<NeedClassTotal[]> {
    return this.http.get<NeedClassTotal[]>(`${this.base}/reports/by-need-class`, {
      params: this.params({ from, to }),
    });
  }
  monthly(year?: number): Observable<MonthlyReportRow[]> {
    return this.http.get<MonthlyReportRow[]>(`${this.base}/reports/monthly`, {
      params: this.params({ year }),
    });
  }

  // Import
  importTransactions(rows: ImportRow[]): Observable<{ inserted: number }> {
    return this.http.post<{ inserted: number }>(`${this.base}/import/transactions`, {
      rows,
    });
  }
}
