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
  IsDateString,
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

export class CreateGoalDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsNumber() @Min(0) target_amount!: number;
  @IsOptional() @IsNumber() @Min(0) current_amount?: number;
  @IsOptional() @IsUUID() account_id?: string;
  @IsOptional() @IsDateString() target_date?: string;
}

export class UpdateGoalDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsNumber() @Min(0) target_amount?: number;
  @IsOptional() @IsNumber() @Min(0) current_amount?: number;
  @IsOptional() @IsUUID() account_id?: string;
  @IsOptional() @IsDateString() target_date?: string;
}

@UseGuards(AuthGuard)
@Controller('goals')
export class GoalsController {
  @Get()
  list(@Db() db: SupabaseClient) {
    return handle(
      db
        .from('savings_goals')
        .select('*, account:accounts(id,name,type)')
        .order('created_at'),
    );
  }

  @Post()
  create(
    @Db() db: SupabaseClient,
    @CurrentUser() user: User,
    @Body() dto: CreateGoalDto,
  ) {
    return handle(
      db
        .from('savings_goals')
        .insert({ ...dto, user_id: user.id })
        .select()
        .single(),
    );
  }

  @Patch(':id')
  update(
    @Db() db: SupabaseClient,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return handle(
      db.from('savings_goals').update(dto).eq('id', id).select().single(),
    );
  }

  @Delete(':id')
  remove(@Db() db: SupabaseClient, @Param('id') id: string) {
    return handle(db.from('savings_goals').delete().eq('id', id));
  }
}
