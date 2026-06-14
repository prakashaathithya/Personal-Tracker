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
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, Db } from '../auth/decorators';
import { handle } from '../common/handle';

export class CreatePaymentTypeDto {
  @IsString() @MinLength(1) @MaxLength(60) name!: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class UpdatePaymentTypeDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) name?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

@UseGuards(AuthGuard)
@Controller('payment-types')
export class PaymentTypesController {
  @Get()
  list(@Db() db: SupabaseClient) {
    return handle(db.from('payment_types').select('*').order('name'));
  }

  @Post()
  create(
    @Db() db: SupabaseClient,
    @CurrentUser() user: User,
    @Body() dto: CreatePaymentTypeDto,
  ) {
    return handle(
      db
        .from('payment_types')
        .insert({ ...dto, user_id: user.id })
        .select()
        .single(),
    );
  }

  @Patch(':id')
  update(
    @Db() db: SupabaseClient,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentTypeDto,
  ) {
    return handle(
      db.from('payment_types').update(dto).eq('id', id).select().single(),
    );
  }

  @Delete(':id')
  remove(@Db() db: SupabaseClient, @Param('id') id: string) {
    return handle(db.from('payment_types').delete().eq('id', id));
  }
}
