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

@UseGuards(AuthGuard)
@Controller('monthly-budgets')
export class MonthlyBudgetsController {
  @Get()
  list(@Db() db: SupabaseClient) {
    return handle(db.from('monthly_budgets').select('*').order('month'));
  }

  /** Create or update the salary for a given month (unique per user+month). */
  @Put()
  upsert(
    @Db() db: SupabaseClient,
    @CurrentUser() user: User,
    @Body() dto: UpsertMonthlyBudgetDto,
  ) {
    return handle(
      db
        .from('monthly_budgets')
        .upsert(
          { user_id: user.id, month: dto.month, salary: dto.salary },
          { onConflict: 'user_id,month' },
        )
        .select()
        .single(),
    );
  }
}
