import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
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

export class UpdateLoanDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsNumber() @Min(0) principal?: number;
  @IsOptional() @IsNumber() @Min(0) annual_rate?: number;
  @IsOptional() @IsNumber() @Min(0) emi_amount?: number;
  @IsOptional() @IsDateString() start_date?: string;
}

export class UpdateScheduleRowDto {
  @IsBoolean() paid!: boolean;
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

  /**
   * Updates loan terms. When principal, rate, EMI and start date are all
   * known afterwards, the amortization schedule is rebuilt from scratch
   * (existing paid/due progress is reset, mirroring `create`).
   */
  @Patch(':id')
  async update(
    @Db() db: SupabaseClient,
    @Param('id') id: string,
    @Body() dto: UpdateLoanDto,
  ) {
    const loan = await handle<{
      id: string;
      principal: number;
      annual_rate: number | null;
      emi_amount: number | null;
      start_date: string | null;
    }>(db.from('loans').update(dto).eq('id', id).select().single());

    await handle(db.from('loan_schedule').delete().eq('loan_id', id));
    if (loan.annual_rate && loan.emi_amount && loan.start_date) {
      const schedule = buildSchedule({
        principal: loan.principal,
        annualRate: loan.annual_rate,
        emi: loan.emi_amount,
        startDate: loan.start_date,
      });
      if (schedule.length) {
        await handle(
          db
            .from('loan_schedule')
            .insert(schedule.map((r) => ({ ...r, loan_id: id }))),
        );
      }
    }

    return this.get(db, id);
  }

  /** Marks a single amortization row paid/unpaid (used by "Pay now"). */
  @Patch('schedule/:id')
  markPaid(
    @Db() db: SupabaseClient,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleRowDto,
  ) {
    return handle(
      db
        .from('loan_schedule')
        .update({ paid: dto.paid })
        .eq('id', id)
        .select()
        .single(),
    );
  }

  @Delete(':id')
  remove(@Db() db: SupabaseClient, @Param('id') id: string) {
    return handle(db.from('loans').delete().eq('id', id));
  }
}
