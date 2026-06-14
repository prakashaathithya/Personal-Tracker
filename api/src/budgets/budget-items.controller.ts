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

export class CreateBudgetItemDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class UpdateBudgetItemDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

@UseGuards(AuthGuard)
@Controller('budget-items')
export class BudgetItemsController {
  @Get()
  list(@Db() db: SupabaseClient) {
    return handle(db.from('budget_items').select('*').order('name'));
  }

  @Post()
  create(
    @Db() db: SupabaseClient,
    @CurrentUser() user: User,
    @Body() dto: CreateBudgetItemDto,
  ) {
    return handle(
      db
        .from('budget_items')
        .insert({ ...dto, user_id: user.id })
        .select()
        .single(),
    );
  }

  @Patch(':id')
  update(
    @Db() db: SupabaseClient,
    @Param('id') id: string,
    @Body() dto: UpdateBudgetItemDto,
  ) {
    return handle(
      db.from('budget_items').update(dto).eq('id', id).select().single(),
    );
  }

  @Delete(':id')
  remove(@Db() db: SupabaseClient, @Param('id') id: string) {
    return handle(db.from('budget_items').delete().eq('id', id));
  }
}
