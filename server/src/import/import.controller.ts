import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
import { CategorizationRule, matchCategory } from '../common/rule-match';
import { distinct, keyOf } from './dedupe';

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

  /** When true, rows matching an existing transaction are silently skipped. */
  @IsOptional() @IsBoolean() skipDuplicates?: boolean;
}

interface ExistingTxn {
  txn_date: string;
  amount: number;
  description: string;
  direction: string;
}

// Each call can carry 5000 rows and fans out into several round trips, so
// these two get a far tighter budget than the global one.
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@UseGuards(AuthGuard)
@Controller('import')
export class ImportController {
  /**
   * Dry run: reports how many rows are duplicates of existing transactions,
   * which categories/payment types would be created, and a per-row duplicate
   * flag (aligned to the input order) — without writing anything.
   */
  @Post('preview')
  async preview(@Db() db: SupabaseClient, @Body() dto: ImportTransactionsDto) {
    const existingKeys = await this.existingKeys(db, dto.rows);

    const seen = new Set<string>();
    const flags = dto.rows.map((r) => {
      const k = keyOf(r);
      const dup = existingKeys.has(k) || seen.has(k);
      seen.add(k);
      return dup;
    });
    const duplicates = flags.filter(Boolean).length;

    const existingCats = new Set(
      (
        await handle<{ name: string }[]>(db.from('categories').select('name'))
      )?.map((c) => c.name.toLowerCase()) ?? [],
    );
    const existingPmts = new Set(
      (
        await handle<{ name: string }[]>(
          db.from('payment_types').select('name'),
        )
      )?.map((p) => p.name.toLowerCase()) ?? [],
    );
    const newCategories = distinct(dto.rows.map((r) => r.category)).filter(
      (n) => !existingCats.has(n.toLowerCase()),
    );
    const newPaymentTypes = distinct(
      dto.rows.map((r) => r.payment_type),
    ).filter((n) => !existingPmts.has(n.toLowerCase()));

    return {
      total: dto.rows.length,
      duplicates,
      newRows: dto.rows.length - duplicates,
      newCategories,
      newPaymentTypes,
      flags,
    };
  }

  @Post('transactions')
  async importTransactions(
    @Db() db: SupabaseClient,
    @CurrentUser() user: User,
    @Body() dto: ImportTransactionsDto,
  ) {
    let rows = dto.rows;
    let skipped = 0;

    if (dto.skipDuplicates) {
      const existingKeys = await this.existingKeys(db, rows);
      const seen = new Set<string>();
      rows = rows.filter((r) => {
        const k = keyOf(r);
        if (existingKeys.has(k) || seen.has(k)) {
          skipped += 1;
          return false;
        }
        seen.add(k);
        return true;
      });
    }

    const categoryMap = await this.resolveLookup(
      db,
      'categories',
      user.id,
      distinct(rows.map((r) => r.category)),
      (name) => ({ user_id: user.id, name, need_class: 'Others' }),
    );
    const paymentMap = await this.resolveLookup(
      db,
      'payment_types',
      user.id,
      distinct(rows.map((r) => r.payment_type)),
      (name) => ({ user_id: user.id, name }),
    );

    // Rows without an explicit category fall back to auto-categorization rules.
    const rules =
      (await handle<CategorizationRule[]>(
        db
          .from('categorization_rules')
          .select('match, pattern, category_id')
          .eq('is_active', true)
          .order('priority'),
      )) ?? [];

    const toInsert = rows.map((r) => ({
      user_id: user.id,
      txn_date: r.txn_date,
      description: r.description,
      amount: r.amount,
      direction: 'expense',
      planned: r.planned ?? false,
      category_id: r.category
        ? (categoryMap.get(r.category) ?? null)
        : matchCategory(rules, r.description),
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

    return {
      inserted,
      skipped,
      categories: categoryMap.size,
      payment_types: paymentMap.size,
    };
  }

  /** Natural keys of existing transactions within the import's date span. */
  private async existingKeys(
    db: SupabaseClient,
    rows: ImportRowDto[],
  ): Promise<Set<string>> {
    if (rows.length === 0) return new Set();
    const dates = rows.map((r) => r.txn_date).sort();
    const existing = await handle<ExistingTxn[]>(
      db
        .from('transactions')
        .select('txn_date, amount, description, direction')
        .gte('txn_date', dates[0])
        .lte('txn_date', dates[dates.length - 1]),
    );
    return new Set((existing ?? []).map(keyOf));
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
