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
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, Db } from '../auth/decorators';
import { handle } from '../common/handle';
import { CategorizationRule, ruleMatches } from '../common/rule-match';

const MATCH_TYPES = ['contains', 'equals', 'regex'] as const;
type MatchType = (typeof MATCH_TYPES)[number];

export class CreateRuleDto {
  @IsIn(MATCH_TYPES) match!: MatchType;
  @IsString() @MinLength(1) @MaxLength(200) pattern!: string;
  @IsUUID() category_id!: string;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class UpdateRuleDto {
  @IsOptional() @IsIn(MATCH_TYPES) match?: MatchType;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) pattern?: string;
  @IsOptional() @IsUUID() category_id?: string;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

@UseGuards(AuthGuard)
@Controller('rules')
export class RulesController {
  @Get()
  list(@Db() db: SupabaseClient) {
    return handle(
      db
        .from('categorization_rules')
        .select('*, category:categories(id,name,need_class)')
        .order('priority')
        .order('created_at'),
    );
  }

  @Post()
  create(
    @Db() db: SupabaseClient,
    @CurrentUser() user: User,
    @Body() dto: CreateRuleDto,
  ) {
    return handle(
      db
        .from('categorization_rules')
        .insert({ ...dto, user_id: user.id })
        .select()
        .single(),
    );
  }

  @Patch(':id')
  update(
    @Db() db: SupabaseClient,
    @Param('id') id: string,
    @Body() dto: UpdateRuleDto,
  ) {
    return handle(
      db
        .from('categorization_rules')
        .update(dto)
        .eq('id', id)
        .select()
        .single(),
    );
  }

  @Delete(':id')
  remove(@Db() db: SupabaseClient, @Param('id') id: string) {
    return handle(db.from('categorization_rules').delete().eq('id', id));
  }

  /**
   * Applies active rules to expense transactions that have no category yet,
   * setting the category of the first matching rule (by priority).
   */
  @Post('apply')
  async apply(@Db() db: SupabaseClient) {
    const rules =
      (await handle<CategorizationRule[]>(
        db
          .from('categorization_rules')
          .select('match, pattern, category_id')
          .eq('is_active', true)
          .order('priority'),
      )) ?? [];
    if (!rules.length) return { updated: 0 };

    const txns =
      (await handle<{ id: string; description: string }[]>(
        db
          .from('transactions')
          .select('id, description')
          .is('category_id', null)
          .eq('direction', 'expense'),
      )) ?? [];

    const idsByCategory = new Map<string, string[]>();
    for (const t of txns) {
      const rule = rules.find((r) => ruleMatches(r, t.description));
      if (!rule) continue;
      const list = idsByCategory.get(rule.category_id) ?? [];
      list.push(t.id);
      idsByCategory.set(rule.category_id, list);
    }

    let updated = 0;
    for (const [category_id, ids] of idsByCategory) {
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        await handle(
          db.from('transactions').update({ category_id }).in('id', chunk),
        );
        updated += chunk.length;
      }
    }
    return { updated };
  }
}
