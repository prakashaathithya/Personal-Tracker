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
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, Db } from '../auth/decorators';
import { handle } from '../common/handle';

const DIRECTIONS = ['income', 'expense', 'transfer'] as const;
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const;
type Direction = (typeof DIRECTIONS)[number];
type Frequency = (typeof FREQUENCIES)[number];

const EMBED =
  '*, category:categories(id,name,need_class), payment_type:payment_types(id,name), account:accounts!recurring_transactions_account_id_fkey(id,name,type), transfer_account:accounts!recurring_transactions_transfer_account_id_fkey(id,name,type)';

export class CreateRecurringDto {
  @IsString() @MinLength(1) @MaxLength(200) description!: string;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsIn(DIRECTIONS) direction?: Direction;
  @IsIn(FREQUENCIES) frequency!: Frequency;
  @IsOptional() @IsInt() @Min(1) interval_count?: number;
  @IsDateString() next_run!: string;
  @IsOptional() @IsDateString() end_date?: string;
  @IsOptional() @IsUUID() category_id?: string;
  @IsOptional() @IsUUID() payment_type_id?: string;
  @IsOptional() @IsUUID() account_id?: string;
  @IsOptional() @IsUUID() transfer_account_id?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class UpdateRecurringDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) description?: string;
  @IsOptional() @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsIn(DIRECTIONS) direction?: Direction;
  @IsOptional() @IsIn(FREQUENCIES) frequency?: Frequency;
  @IsOptional() @IsInt() @Min(1) interval_count?: number;
  @IsOptional() @IsDateString() next_run?: string;
  @IsOptional() @IsDateString() end_date?: string;
  @IsOptional() @IsUUID() category_id?: string;
  @IsOptional() @IsUUID() payment_type_id?: string;
  @IsOptional() @IsUUID() account_id?: string;
  @IsOptional() @IsUUID() transfer_account_id?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

@UseGuards(AuthGuard)
@Controller('recurring')
export class RecurringController {
  @Get()
  list(@Db() db: SupabaseClient) {
    return handle(
      db.from('recurring_transactions').select(EMBED).order('next_run'),
    );
  }

  @Post()
  create(
    @Db() db: SupabaseClient,
    @CurrentUser() user: User,
    @Body() dto: CreateRecurringDto,
  ) {
    return handle(
      db
        .from('recurring_transactions')
        .insert({ ...dto, user_id: user.id })
        .select(EMBED)
        .single(),
    );
  }

  @Patch(':id')
  update(
    @Db() db: SupabaseClient,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringDto,
  ) {
    return handle(
      db
        .from('recurring_transactions')
        .update(dto)
        .eq('id', id)
        .select(EMBED)
        .single(),
    );
  }

  @Delete(':id')
  remove(@Db() db: SupabaseClient, @Param('id') id: string) {
    return handle(db.from('recurring_transactions').delete().eq('id', id));
  }

  /**
   * Catch-up: materialize any occurrences due up to today for the caller.
   * Also runs nightly via pg_cron for all users.
   */
  @Post('run')
  async run(@Db() db: SupabaseClient) {
    const { data, error } = await db.rpc('run_due_recurring');
    if (error) throw error;
    return { generated: (data as number) ?? 0 };
  }
}
