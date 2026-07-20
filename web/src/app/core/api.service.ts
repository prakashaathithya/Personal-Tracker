import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Account,
  BudgetItem,
  CategorizationRule,
  Category,
  CategoryTotal,
  ImportRow,
  RecurringTransaction,
  ImportPreview,
  Loan,
  LoanScheduleRow,
  MonthlyBudget,
  MonthlyReportRow,
  NeedClassTotal,
  NetWorth,
  NetWorthPoint,
  Paged,
  PaymentType,
  PaymentTypeTotal,
  ReportMatrix,
  SavingsGoal,
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

  // Accounts
  listAccounts(): Observable<Account[]> {
    return this.http.get<Account[]>(`${this.base}/accounts`);
  }
  accountBalances(): Observable<NetWorth> {
    return this.http.get<NetWorth>(`${this.base}/accounts/balances`);
  }
  netWorthTrend(): Observable<NetWorthPoint[]> {
    return this.http.get<NetWorthPoint[]>(`${this.base}/accounts/net-worth-trend`);
  }
  createAccount(body: Partial<Account>): Observable<Account> {
    return this.http.post<Account>(`${this.base}/accounts`, body);
  }
  updateAccount(id: string, body: Partial<Account>): Observable<Account> {
    return this.http.patch<Account>(`${this.base}/accounts/${id}`, body);
  }
  deleteAccount(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/accounts/${id}`);
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
  updateLoan(id: string, body: Partial<Loan>): Observable<Loan> {
    return this.http.patch<Loan>(`${this.base}/loans/${id}`, body);
  }
  deleteLoan(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/loans/${id}`);
  }
  setInstallmentPaid(scheduleId: string, paid: boolean): Observable<LoanScheduleRow> {
    return this.http.patch<LoanScheduleRow>(`${this.base}/loans/schedule/${scheduleId}`, { paid });
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
  byPaymentType(from?: string, to?: string): Observable<PaymentTypeTotal[]> {
    return this.http.get<PaymentTypeTotal[]>(`${this.base}/reports/by-payment-type`, {
      params: this.params({ from, to }),
    });
  }
  matrix(year: number, dim: ReportMatrix['dim']): Observable<ReportMatrix> {
    return this.http.get<ReportMatrix>(`${this.base}/reports/matrix`, {
      params: this.params({ year, dim }),
    });
  }
  monthly(year?: number): Observable<MonthlyReportRow[]> {
    return this.http.get<MonthlyReportRow[]>(`${this.base}/reports/monthly`, {
      params: this.params({ year }),
    });
  }

  // Categorization rules
  listRules(): Observable<CategorizationRule[]> {
    return this.http.get<CategorizationRule[]>(`${this.base}/rules`);
  }
  createRule(body: Partial<CategorizationRule>): Observable<CategorizationRule> {
    return this.http.post<CategorizationRule>(`${this.base}/rules`, body);
  }
  updateRule(id: string, body: Partial<CategorizationRule>): Observable<CategorizationRule> {
    return this.http.patch<CategorizationRule>(`${this.base}/rules/${id}`, body);
  }
  deleteRule(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/rules/${id}`);
  }
  applyRules(): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(`${this.base}/rules/apply`, {});
  }

  // Recurring transactions
  listRecurring(): Observable<RecurringTransaction[]> {
    return this.http.get<RecurringTransaction[]>(`${this.base}/recurring`);
  }
  createRecurring(body: Partial<RecurringTransaction>): Observable<RecurringTransaction> {
    return this.http.post<RecurringTransaction>(`${this.base}/recurring`, body);
  }
  updateRecurring(id: string, body: Partial<RecurringTransaction>): Observable<RecurringTransaction> {
    return this.http.patch<RecurringTransaction>(`${this.base}/recurring/${id}`, body);
  }
  deleteRecurring(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/recurring/${id}`);
  }
  runRecurring(): Observable<{ generated: number }> {
    return this.http.post<{ generated: number }>(`${this.base}/recurring/run`, {});
  }

  // Savings goals
  listGoals(): Observable<SavingsGoal[]> {
    return this.http.get<SavingsGoal[]>(`${this.base}/goals`);
  }
  createGoal(body: Partial<SavingsGoal>): Observable<SavingsGoal> {
    return this.http.post<SavingsGoal>(`${this.base}/goals`, body);
  }
  updateGoal(id: string, body: Partial<SavingsGoal>): Observable<SavingsGoal> {
    return this.http.patch<SavingsGoal>(`${this.base}/goals/${id}`, body);
  }
  deleteGoal(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/goals/${id}`);
  }

  // Import
  previewImport(rows: ImportRow[]): Observable<ImportPreview> {
    return this.http.post<ImportPreview>(`${this.base}/import/preview`, { rows });
  }
  importTransactions(
    rows: ImportRow[],
    skipDuplicates = true,
  ): Observable<{ inserted: number; skipped: number }> {
    return this.http.post<{ inserted: number; skipped: number }>(
      `${this.base}/import/transactions`,
      { rows, skipDuplicates },
    );
  }
}
