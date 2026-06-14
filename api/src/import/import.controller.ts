import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, Db } from '../auth/decorators';
import { handle } from '../common/handle';

export class ImportRowDto {
  @IsDateString() txn_date!: string;
  @IsString() @MaxLength(200) description!: string;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsString() @MaxLength(60) payment_type?: string;
  @IsOptional() @IsBoolean() planned?: boolean;
}

export class ImportTransactionsDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows!: ImportRowDto[];
}

@UseGuards(AuthGuard)
@Controller('import')
export class ImportController {
  @Post('transactions')
  async importTransactions(
    @Db() db: SupabaseClient,
    @CurrentUser() user: User,
    @Body() dto: ImportTransactionsDto,
  ) {
    const categoryMap = await this.resolveLookup(
      db,
      'categories',
      user.id,
      this.distinct(dto.rows.map((r) => r.category)),
      (name) => ({ user_id: user.id, name, need_class: 'Others' }),
    );
    const paymentMap = await this.resolveLookup(
      db,
      'payment_types',
      user.id,
      this.distinct(dto.rows.map((r) => r.payment_type)),
      (name) => ({ user_id: user.id, name }),
    );

    const toInsert = dto.rows.map((r) => ({
      user_id: user.id,
      txn_date: r.txn_date,
      description: r.description,
      amount: r.amount,
      planned: r.planned ?? false,
      category_id: r.category ? (categoryMap.get(r.category) ?? null) : null,
      payment_type_id: r.payment_type
        ? (paymentMap.get(r.payment_type) ?? null)
        : null,
    }));

    // Insert in chunks to stay within request/timeout limits.
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 500) {
      const chunk = toInsert.slice(i, i + 500);
      const data = await handle<unknown[]>(
        db.from('transactions').insert(chunk).select('id'),
      );
      inserted += data?.length ?? 0;
    }

    return { inserted, categories: categoryMap.size, payment_types: paymentMap.size };
  }

  private distinct(values: (string | undefined)[]): string[] {
    return [
      ...new Set(values.filter((v): v is string => !!v && v.trim().length > 0)),
    ];
  }

  /**
   * Returns a name -> id map for a lookup table, creating any names that don't
   * exist yet for this user.
   */
  private async resolveLookup(
    db: SupabaseClient,
    table: 'categories' | 'payment_types',
    userId: string,
    names: string[],
    buildRow: (name: string) => Record<string, unknown>,
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (names.length === 0) return map;

    const existing = await handle<{ id: string; name: string }[]>(
      db.from(table).select('id, name').eq('user_id', userId),
    );
    for (const row of existing ?? []) map.set(row.name, row.id);

    const missing = names.filter((n) => !map.has(n));
    if (missing.length) {
      const created = await handle<{ id: string; name: string }[]>(
        db.from(table).insert(missing.map(buildRow)).select('id, name'),
      );
      for (const row of created ?? []) map.set(row.name, row.id);
    }

    return map;
  }
}
