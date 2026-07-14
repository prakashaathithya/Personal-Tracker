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
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, Db } from '../auth/decorators';
import { handle } from '../common/handle';

export const ACCOUNT_TYPES = [
  'cash',
  'bank',
  'credit_card',
  'wallet',
  'investment',
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export class CreateAccountDto {
  @IsString() @MinLength(1) @MaxLength(60) name!: string;
  @IsOptional() @IsIn(ACCOUNT_TYPES) type?: AccountType;
  @IsOptional() @IsNumber() opening_balance?: number;
}

export class UpdateAccountDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) name?: string;
  @IsOptional() @IsIn(ACCOUNT_TYPES) type?: AccountType;
  @IsOptional() @IsNumber() opening_balance?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

interface AccountRow {
  id: string;
  name: string;
  type: AccountType;
  opening_balance: number;
  is_active: boolean;
  created_at: string;
}

interface BalanceTxnRow {
  amount: number;
  direction: 'income' | 'expense' | 'transfer';
  account_id: string | null;
  transfer_account_id: string | null;
}

@UseGuards(AuthGuard)
@Controller('accounts')
export class AccountsController {
  @Get()
  list(@Db() db: SupabaseClient) {
    return handle(db.from('accounts').select('*').order('created_at'));
  }

  /**
   * Every account's live balance plus overall net worth. Balance is the
   * opening balance adjusted by income (+), expense (-), and transfers
   * (- from the source account, + to the destination account).
   */
  @Get('balances')
  async balances(@Db() db: SupabaseClient) {
    const accounts = await handle<AccountRow[]>(
      db.from('accounts').select('*').order('created_at'),
    );
    const txns = await handle<BalanceTxnRow[]>(
      db
        .from('transactions')
        .select('amount, direction, account_id, transfer_account_id'),
    );

    const balance = new Map<string, number>();
    for (const a of accounts ?? []) {
      balance.set(a.id, Number(a.opening_balance));
    }

    const add = (id: string | null, delta: number) => {
      if (id && balance.has(id)) balance.set(id, balance.get(id)! + delta);
    };
    for (const t of txns ?? []) {
      const amt = Number(t.amount);
      if (t.direction === 'income') add(t.account_id, amt);
      else if (t.direction === 'expense') add(t.account_id, -amt);
      else {
        add(t.account_id, -amt);
        add(t.transfer_account_id, amt);
      }
    }

    const withBalances = (accounts ?? []).map((a) => ({
      ...a,
      balance: balance.get(a.id) ?? Number(a.opening_balance),
    }));
    const net_worth = withBalances.reduce((sum, a) => sum + a.balance, 0);
    return { accounts: withBalances, net_worth };
  }

  /**
   * Net worth at the end of each month, computed retroactively from opening
   * balances plus cumulative income − expense (transfers cancel out in the
   * total). Months with no activity are filled so the series is continuous.
   */
  @Get('net-worth-trend')
  async netWorthTrend(@Db() db: SupabaseClient) {
    const accounts = await handle<AccountRow[]>(
      db.from('accounts').select('opening_balance'),
    );
    const opening = (accounts ?? []).reduce(
      (sum, a) => sum + Number(a.opening_balance),
      0,
    );

    const txns = await handle<{ txn_date: string; amount: number; direction: string }[]>(
      db.from('transactions').select('txn_date, amount, direction'),
    );

    const deltaByMonth = new Map<string, number>();
    for (const t of txns ?? []) {
      if (t.direction === 'transfer') continue;
      const month = t.txn_date.slice(0, 7);
      const delta = t.direction === 'income' ? Number(t.amount) : -Number(t.amount);
      deltaByMonth.set(month, (deltaByMonth.get(month) ?? 0) + delta);
    }

    const months = [...deltaByMonth.keys()].sort();
    if (months.length === 0) {
      const now = new Date().toISOString().slice(0, 7);
      return [{ month: now, net_worth: opening }];
    }

    // Fill every month from the first activity to the current month.
    const series: { month: string; net_worth: number }[] = [];
    let running = opening;
    let [y, m] = months[0].split('-').map(Number);
    const now = new Date();
    const endY = now.getFullYear();
    const endM = now.getMonth() + 1;
    while (y < endY || (y === endY && m <= endM)) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      running += deltaByMonth.get(key) ?? 0;
      series.push({ month: key, net_worth: running });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return series;
  }

  @Post()
  create(
    @Db() db: SupabaseClient,
    @CurrentUser() user: User,
    @Body() dto: CreateAccountDto,
  ) {
    return handle(
      db
        .from('accounts')
        .insert({ ...dto, user_id: user.id })
        .select()
        .single(),
    );
  }

  @Patch(':id')
  update(
    @Db() db: SupabaseClient,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return handle(
      db.from('accounts').update(dto).eq('id', id).select().single(),
    );
  }

  /**
   * Deletes an account. Any transactions pointing at it keep their history
   * but have their account link cleared (FK is ON DELETE SET NULL).
   */
  @Delete(':id')
  remove(@Db() db: SupabaseClient, @Param('id') id: string) {
    return handle(db.from('accounts').delete().eq('id', id));
  }
}
