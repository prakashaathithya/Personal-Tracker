import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, Db } from '../auth/decorators';
import { handle } from '../common/handle';
import { buildSchedule } from './amortization';

export class CreateLoanDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsNumber() @Min(0) principal!: number;
  @IsOptional() @IsNumber() @Min(0) annual_rate?: number;
  @IsOptional() @IsNumber() @Min(0) emi_amount?: number;
  @IsOptional() @IsDateString() start_date?: string;
}

@UseGuards(AuthGuard)
@Controller('loans')
export class LoansController {
  @Get()
  list(@Db() db: SupabaseClient) {
    return handle(db.from('loans').select('*').order('created_at'));
  }

  /** Loan plus its full amortization schedule. */
  @Get(':id')
  get(@Db() db: SupabaseClient, @Param('id') id: string) {
    return handle(
      db
        .from('loans')
        .select('*, schedule:loan_schedule(*)')
        .eq('id', id)
        .order('period', { referencedTable: 'loan_schedule' })
        .single(),
    );
  }

  /**
   * Creates a loan. When rate, EMI and start date are supplied, the
   * amortization schedule is generated and stored automatically.
   */
  @Post()
  async create(
    @Db() db: SupabaseClient,
    @CurrentUser() user: User,
    @Body() dto: CreateLoanDto,
  ) {
    const loan = await handle<{ id: string }>(
      db
        .from('loans')
        .insert({ ...dto, user_id: user.id })
        .select()
        .single(),
    );

    if (dto.annual_rate && dto.emi_amount && dto.start_date) {
      const schedule = buildSchedule({
        principal: dto.principal,
        annualRate: dto.annual_rate,
        emi: dto.emi_amount,
        startDate: dto.start_date,
      });
      if (schedule.length) {
        await handle(
          db
            .from('loan_schedule')
            .insert(schedule.map((r) => ({ ...r, loan_id: loan.id }))),
        );
      }
    }

    return this.get(db, loan.id);
  }

  @Delete(':id')
  remove(@Db() db: SupabaseClient, @Param('id') id: string) {
    return handle(db.from('loans').delete().eq('id', id));
  }
}
