import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { Db } from '../auth/decorators';

interface TxnRow {
  amount: number;
  planned: boolean;
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
      .select('amount, planned, txn_date, category:categories(name,need_class)');
    if (from) q = q.gte('txn_date', from);
    if (to) q = q.lte('txn_date', to);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as TxnRow[];
  }

  /** Totals and planned/unplanned split for a date range. */
  @Get('summary')
  async summary(@Db() db: SupabaseClient, @Query() q: RangeQuery) {
    const rows = await this.rows(db, q.from, q.to);
    let total = 0;
    let planned = 0;
    let unplanned = 0;
    for (const r of rows) {
      const amt = Number(r.amount);
      total += amt;
      if (r.planned) planned += amt;
      else unplanned += amt;
    }
    return { total, planned, unplanned, count: rows.length };
  }

  /** Spend grouped by category. */
  @Get('by-category')
  async byCategory(@Db() db: SupabaseClient, @Query() q: RangeQuery) {
    const rows = await this.rows(db, q.from, q.to);
    const map = new Map<string, { category: string; total: number; count: number }>();
    for (const r of rows) {
      const name = r.category?.name ?? 'Uncategorized';
      const entry = map.get(name) ?? { category: name, total: 0, count: 0 };
      entry.total += Number(r.amount);
      entry.count += 1;
      map.set(name, entry);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }

  /** Needs / Wants / Saving / Others split. */
  @Get('by-need-class')
  async byNeedClass(@Db() db: SupabaseClient, @Query() q: RangeQuery) {
    const rows = await this.rows(db, q.from, q.to);
    const map = new Map<string, number>();
    for (const r of rows) {
      const key = r.category?.need_class ?? 'Others';
      map.set(key, (map.get(key) ?? 0) + Number(r.amount));
    }
    return [...map.entries()].map(([need_class, total]) => ({
      need_class,
      total,
    }));
  }

  /** Per-month spend for a year, merged with stored salary -> balance. */
  @Get('monthly')
  async monthly(@Db() db: SupabaseClient, @Query() q: YearQuery) {
    const year = q.year ?? new Date().getFullYear();
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    const rows = await this.rows(db, from, to);
    const spendByMonth = new Array<number>(12).fill(0);
    for (const r of rows) {
      const m = new Date(r.txn_date).getMonth();
      spendByMonth[m] += Number(r.amount);
    }

    const { data: budgets, error } = await db
      .from('monthly_budgets')
      .select('month, salary')
      .gte('month', from)
      .lte('month', to);
    if (error) throw error;

    const salaryByMonth = new Array<number>(12).fill(0);
    for (const b of budgets ?? []) {
      salaryByMonth[new Date(b.month as string).getMonth()] = Number(b.salary);
    }

    return Array.from({ length: 12 }, (_, i) => ({
      year,
      month: i + 1,
      salary: salaryByMonth[i],
      usage: spendByMonth[i],
      balance: salaryByMonth[i] - spendByMonth[i],
    }));
  }
}
