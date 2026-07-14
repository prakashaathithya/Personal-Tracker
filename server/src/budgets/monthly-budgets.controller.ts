import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { IsDateString, IsNumber, Min } from 'class-validator';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, Db } from '../auth/decorators';
import { handle } from '../common/handle';

export class UpsertMonthlyBudgetDto {
  /** First day of the month, e.g. "2026-01-01". */
  @IsDateString() month!: string;
  @IsNumber() @Min(0) salary!: number;
}

/**
 * Monthly income view. Salary is no longer a separate store — it is derived
 * from `income`-direction transactions. This controller keeps the legacy
 * `{ month, salary }` shape so the budget screen works unchanged: the list
 * aggregates income per month, and the upsert writes a single "Salary" income
 * transaction for the chosen month.
 */
@UseGuards(AuthGuard)
@Controller('monthly-budgets')
export class MonthlyBudgetsController {
  @Get()
  async list(@Db() db: SupabaseClient) {
    const rows = await handle<{ txn_date: string; amount: number }[]>(
      db
        .from('transactions')
        .select('txn_date, amount')
        .eq('direction', 'income'),
    );
    const byMonth = new Map<string, number>();
    for (const r of rows ?? []) {
      const month = `${r.txn_date.slice(0, 7)}-01`;
      byMonth.set(month, (byMonth.get(month) ?? 0) + Number(r.amount));
    }
    return [...byMonth.entries()]
      .map(([month, salary]) => ({ id: month, month, salary }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Sets the "Salary" income for a month. Updates the existing Salary income
   * transaction for that month if present, otherwise creates one, tagged to
   * the Salary category and the user's first account when available.
   */
  @Put()
  async upsert(
    @Db() db: SupabaseClient,
    @CurrentUser() user: User,
    @Body() dto: UpsertMonthlyBudgetDto,
  ) {
    const month = `${dto.month.slice(0, 7)}-01`;

    const existing = await handle<{ id: string }[]>(
      db
        .from('transactions')
        .select('id')
        .eq('direction', 'income')
        .eq('description', 'Salary')
        .eq('txn_date', month)
        .limit(1),
    );
    if (existing?.length) {
      return handle(
        db
          .from('transactions')
          .update({ amount: dto.salary })
          .eq('id', existing[0].id)
          .select()
          .single(),
      );
    }

    const [cat] = (await handle<{ id: string }[]>(
      db.from('categories').select('id').eq('name', 'Salary').limit(1),
    )) ?? [];
    const [account] = (await handle<{ id: string }[]>(
      db.from('accounts').select('id').order('created_at').limit(1),
    )) ?? [];

    return handle(
      db
        .from('transactions')
        .insert({
          user_id: user.id,
          txn_date: month,
          description: 'Salary',
          amount: dto.salary,
          direction: 'income',
          category_id: cat?.id ?? null,
          account_id: account?.id ?? null,
          planned: false,
        })
        .select()
        .single(),
    );
  }
}
