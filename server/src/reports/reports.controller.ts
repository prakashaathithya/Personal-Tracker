import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { Db } from '../auth/decorators';

type Direction = 'income' | 'expense' | 'transfer';

interface TxnRow {
  amount: number;
  planned: boolean;
  direction: Direction;
  txn_date: string;
  category: { name: string; need_class: string } | null;
}

export class RangeQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class YearQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100)
  year?: number;
}

@UseGuards(AuthGuard)
@Controller('reports')
export class ReportsController {
  private async rows(
    db: SupabaseClient,
    from?: string,
    to?: string,
  ): Promise<TxnRow[]> {
    let q = db
      .from('transactions')
      .select(
        'amount, planned, direction, txn_date, category:categories(name,need_class)',
      );
    if (from) q = q.gte('txn_date', from);
    if (to) q = q.lte('txn_date', to);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as TxnRow[];
  }

  /**
   * Income / expense / net for a date range, plus the planned-vs-unplanned
   * split of expenses. `total` and `count` describe spend so existing
   * "total spent" surfaces keep working.
   */
  @Get('summary')
  async summary(@Db() db: SupabaseClient, @Query() q: RangeQuery) {
    const rows = await this.rows(db, q.from, q.to);
    let income = 0;
    let expense = 0;
    let planned = 0;
    let unplanned = 0;
    let expenseCount = 0;
    for (const r of rows) {
      const amt = Number(r.amount);
      if (r.direction === 'income') {
        income += amt;
      } else if (r.direction === 'expense') {
        expense += amt;
        expenseCount += 1;
        if (r.planned) planned += amt;
        else unplanned += amt;
      }
      // transfers are excluded from income/expense totals
    }
    return {
      income,
      expense,
      net: income - expense,
      total: expense,
      planned,
      unplanned,
      count: expenseCount,
    };
  }

  /** Expense grouped by category (income and transfers excluded). */
  @Get('by-category')
  async byCategory(@Db() db: SupabaseClient, @Query() q: RangeQuery) {
    const rows = await this.rows(db, q.from, q.to);
    const map = new Map<
      string,
      { category: string; total: number; count: number }
    >();
    for (const r of rows) {
      if (r.direction !== 'expense') continue;
      const name = r.category?.name ?? 'Uncategorized';
      const entry = map.get(name) ?? { category: name, total: 0, count: 0 };
      entry.total += Number(r.amount);
      entry.count += 1;
      map.set(name, entry);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }

  /** Needs / Wants / Saving / Others split of expenses. */
  @Get('by-need-class')
  async byNeedClass(@Db() db: SupabaseClient, @Query() q: RangeQuery) {
    const rows = await this.rows(db, q.from, q.to);
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.direction !== 'expense') continue;
      const key = r.category?.need_class ?? 'Others';
      map.set(key, (map.get(key) ?? 0) + Number(r.amount));
    }
    return [...map.entries()].map(([need_class, total]) => ({
      need_class,
      total,
    }));
  }

  /**
   * Per-month income and expense for a year. `salary` carries income and
   * `usage` carries expense so existing dashboard charts keep working.
   */
  @Get('monthly')
  async monthly(@Db() db: SupabaseClient, @Query() q: YearQuery) {
    const year = q.year ?? new Date().getFullYear();
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    const rows = await this.rows(db, from, to);
    const incomeByMonth = new Array<number>(12).fill(0);
    const expenseByMonth = new Array<number>(12).fill(0);
    for (const r of rows) {
      // txn_date is 'YYYY-MM-DD'; parse the month directly to avoid timezone drift.
      const m = Number(r.txn_date.slice(5, 7)) - 1;
      if (m < 0 || m > 11) continue;
      if (r.direction === 'income') incomeByMonth[m] += Number(r.amount);
      else if (r.direction === 'expense') expenseByMonth[m] += Number(r.amount);
    }

    return Array.from({ length: 12 }, (_, i) => ({
      year,
      month: i + 1,
      salary: incomeByMonth[i],
      usage: expenseByMonth[i],
      balance: incomeByMonth[i] - expenseByMonth[i],
    }));
  }
}
