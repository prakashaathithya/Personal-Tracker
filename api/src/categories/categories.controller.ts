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
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, Db } from '../auth/decorators';
import { handle } from '../common/handle';

export enum NeedClass {
  Needs = 'Needs',
  Wants = 'Wants',
  Saving = 'Saving',
  Others = 'Others',
}

export class CreateCategoryDto {
  @IsString() @MinLength(1) @MaxLength(60) name!: string;
  @IsEnum(NeedClass) need_class!: NeedClass;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) name?: string;
  @IsOptional() @IsEnum(NeedClass) need_class?: NeedClass;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

@UseGuards(AuthGuard)
@Controller('categories')
export class CategoriesController {
  @Get()
  list(@Db() db: SupabaseClient) {
    return handle(db.from('categories').select('*').order('name'));
  }

  @Post()
  create(
    @Db() db: SupabaseClient,
    @CurrentUser() user: User,
    @Body() dto: CreateCategoryDto,
  ) {
    return handle(
      db
        .from('categories')
        .insert({ ...dto, user_id: user.id })
        .select()
        .single(),
    );
  }

  @Patch(':id')
  update(
    @Db() db: SupabaseClient,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return handle(
      db.from('categories').update(dto).eq('id', id).select().single(),
    );
  }

  @Delete(':id')
  remove(@Db() db: SupabaseClient, @Param('id') id: string) {
    return handle(db.from('categories').delete().eq('id', id));
  }
}
