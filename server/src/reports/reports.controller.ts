import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { Db } from '../auth/decorators';
import {
  buildMatrix,
  groupByCategory,
  groupByNeedClass,
  groupByPaymentType,
  monthlySeries,
  summarize,
  type MatrixDim,
  type TxnRow,
} from './aggregate';

export class RangeQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class YearQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export class MatrixQuery extends YearQuery {
  @IsOptional()
  @IsIn(['category', 'payment_type', 'need_class'])
  dim?: MatrixDim;
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
        'amount, planned, direction, txn_date, category:categories(name,need_class), payment_type:payment_types(name)',
      );
    if (from) q = q.gte('txn_date', from);
    if (to) q = q.lte('txn_date', to);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as TxnRow[];
  }

  /**
   * Income / expense / net for a date range, plus the planned-vs-unplanned
   * split of expenses.
   */
  @Get('summary')
  async summary(@Db() db: SupabaseClient, @Query() q: RangeQuery) {
    return summarize(await this.rows(db, q.from, q.to));
  }

  /** Expense grouped by category (income and transfers excluded). */
  @Get('by-category')
  async byCategory(@Db() db: SupabaseClient, @Query() q: RangeQuery) {
    return groupByCategory(await this.rows(db, q.from, q.to));
  }

  /** Expense grouped by payment type (Cash / UPI / Credit Card / EMI / …). */
  @Get('by-payment-type')
  async byPaymentType(@Db() db: SupabaseClient, @Query() q: RangeQuery) {
    return groupByPaymentType(await this.rows(db, q.from, q.to));
  }

  /** Month-by-dimension pivot for a year. */
  @Get('matrix')
  async matrix(@Db() db: SupabaseClient, @Query() q: MatrixQuery) {
    const year = q.year ?? new Date().getFullYear();
    const dim: MatrixDim = q.dim ?? 'category';
    const rows = await this.rows(db, `${year}-01-01`, `${year}-12-31`);
    return buildMatrix(rows, year, dim);
  }

  /** Needs / Wants / Saving / Others split of expenses. */
  @Get('by-need-class')
  async byNeedClass(@Db() db: SupabaseClient, @Query() q: RangeQuery) {
    return groupByNeedClass(await this.rows(db, q.from, q.to));
  }

  /** Per-month income and expense for a year. */
  @Get('monthly')
  async monthly(@Db() db: SupabaseClient, @Query() q: YearQuery) {
    const year = q.year ?? new Date().getFullYear();
    const rows = await this.rows(db, `${year}-01-01`, `${year}-12-31`);
    return monthlySeries(rows, year);
  }
}
