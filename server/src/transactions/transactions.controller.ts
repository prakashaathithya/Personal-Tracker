import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, Db } from '../auth/decorators';
import { handle } from '../common/handle';

export const DIRECTIONS = ['income', 'expense', 'transfer'] as const;
export type Direction = (typeof DIRECTIONS)[number];

const EMBED =
  '*, category:categories(id,name,need_class), payment_type:payment_types(id,name), account:accounts!transactions_account_id_fkey(id,name,type), transfer_account:accounts!transactions_transfer_account_id_fkey(id,name,type)';

export class CreateTransactionDto {
  @IsDateString() txn_date!: string;
  @IsString() @MaxLength(200) description!: string;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsIn(DIRECTIONS) direction?: Direction;
  @IsOptional() @IsUUID() category_id?: string;
  @IsOptional() @IsUUID() payment_type_id?: string;
  @IsOptional() @IsUUID() account_id?: string;
  @IsOptional() @IsUUID() transfer_account_id?: string;
  @IsOptional() @IsBoolean() planned?: boolean;
}

export class UpdateTransactionDto {
  @IsOptional() @IsDateString() txn_date?: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsOptional() @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsIn(DIRECTIONS) direction?: Direction;
  @IsOptional() @IsUUID() category_id?: string;
  @IsOptional() @IsUUID() payment_type_id?: string;
  @IsOptional() @IsUUID() account_id?: string;
  @IsOptional() @IsUUID() transfer_account_id?: string;
  @IsOptional() @IsBoolean() planned?: boolean;
  @IsOptional() @IsString() @MaxLength(400) receipt_path?: string;
}

export class ListTransactionsQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsIn(DIRECTIONS) direction?: Direction;
  @IsOptional() @IsUUID() category_id?: string;
  @IsOptional() @IsUUID() payment_type_id?: string;
  @IsOptional() @IsUUID() account_id?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() planned?: boolean;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) limit?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) offset?: number;
}

@UseGuards(AuthGuard)
@Controller('transactions')
export class TransactionsController {
  @Get()
  async list(@Db() db: SupabaseClient, @Query() q: ListTransactionsQuery) {
    const limit = q.limit ?? 50;
    const offset = q.offset ?? 0;

    let query = db
      .from('transactions')
      .select(EMBED, { count: 'exact' })
      .order('txn_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (q.from) query = query.gte('txn_date', q.from);
    if (q.to) query = query.lte('txn_date', q.to);
    if (q.direction) query = query.eq('direction', q.direction);
    if (q.category_id) query = query.eq('category_id', q.category_id);
    if (q.payment_type_id)
      query = query.eq('payment_type_id', q.payment_type_id);
    if (q.account_id) query = query.eq('account_id', q.account_id);
    if (q.planned !== undefined) query = query.eq('planned', q.planned);
    if (q.search) query = query.ilike('description', `%${q.search}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data, count, limit, offset };
  }

  @Get(':id')
  get(@Db() db: SupabaseClient, @Param('id') id: string) {
    return handle(
      db.from('transactions').select(EMBED).eq('id', id).single(),
    );
  }

  @Post()
  create(
    @Db() db: SupabaseClient,
    @CurrentUser() user: User,
    @Body() dto: CreateTransactionDto,
  ) {
    return handle(
      db
        .from('transactions')
        .insert({ ...dto, user_id: user.id })
        .select(EMBED)
        .single(),
    );
  }

  @Patch(':id')
  update(
    @Db() db: SupabaseClient,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return handle(
      db
        .from('transactions')
        .update(dto)
        .eq('id', id)
        .select(EMBED)
        .single(),
    );
  }

  @Delete(':id')
  remove(@Db() db: SupabaseClient, @Param('id') id: string) {
    return handle(db.from('transactions').delete().eq('id', id));
  }
}
