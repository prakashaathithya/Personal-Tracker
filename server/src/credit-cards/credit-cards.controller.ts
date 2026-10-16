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
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { AuthGuard } from '../auth/auth.guard';
import { CronGuard } from '../auth/cron.guard';
import { CurrentUser, Db } from '../auth/decorators';
import { SupabaseService } from '../supabase/supabase.service';
import { CreditCardsService } from './credit-cards.service';
import {
  CreateCreditCardDto,
  CreateEmiPlanDto,
  PayStatementDto,
  UpdateCreditCardDto,
  UpdateStatementDto,
} from './credit-cards.dto';

@UseGuards(AuthGuard)
@Controller('credit-cards')
export class CreditCardsController {
  constructor(private readonly cards: CreditCardsService) {}

  // ---------------------------------------------------------------- cards

  @Get()
  list(@Db() db: SupabaseClient) {
    return this.cards.list(db);
  }

  @Post()
  create(
    @Db() db: SupabaseClient,
    @CurrentUser() user: User,
    @Body() dto: CreateCreditCardDto,
  ) {
    return this.cards.create(db, user.id, dto);
  }

  // Fixed segments must be declared before ':accountId' or Nest routes
  // '/statements' into the parameterised handler.

  // ----------------------------------------------------------- statements

  @Get('statements')
  statements(
    @Db() db: SupabaseClient,
    @Query('card_account_id') cardId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.cards.statements(db, cardId, limit);
  }

  @Get('statements/:id')
  statement(@Db() db: SupabaseClient, @Param('id') id: string) {
    return this.cards.statement(db, id);
  }

  @Patch('statements/:id')
  updateStatement(
    @Db() db: SupabaseClient,
    @Param('id') id: string,
    @Body() dto: UpdateStatementDto,
  ) {
    return this.cards.updateStatement(db, id, dto);
  }

  @Post('statements/:id/pay')
  pay(
    @Db() db: SupabaseClient,
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: PayStatementDto,
  ) {
    return this.cards.pay(db, user.id, id, dto);
  }

  // ------------------------------------------------------------------ EMI

  @Get('emi')
  emiPlans(
    @Db() db: SupabaseClient,
    @Query('card_account_id') cardId?: string,
  ) {
    return this.cards.emiPlans(db, cardId);
  }

  @Post('emi')
  createEmi(
    @Db() db: SupabaseClient,
    @CurrentUser() user: User,
    @Body() dto: CreateEmiPlanDto,
  ) {
    return this.cards.createEmi(db, user.id, dto);
  }

  @Delete('emi/:id')
  removeEmi(@Db() db: SupabaseClient, @Param('id') id: string) {
    return this.cards.removeEmi(db, id);
  }

  // ------------------------------------------------------------- catch-up

  /**
   * Generates any statements whose date has passed and raises the matching
   * alerts. Called on app load; safe to run repeatedly.
   */
  @Post('run')
  run(@Db() db: SupabaseClient, @CurrentUser() user: User) {
    return this.cards.run(db, user.id);
  }

  // -------------------------------------------------- card config by id

  @Get(':accountId/unbilled')
  unbilled(@Db() db: SupabaseClient, @Param('accountId') accountId: string) {
    return this.cards.unbilled(db, accountId);
  }

  @Patch(':accountId')
  update(
    @Db() db: SupabaseClient,
    @Param('accountId') accountId: string,
    @Body() dto: UpdateCreditCardDto,
  ) {
    return this.cards.update(db, accountId, dto);
  }

  @Delete(':accountId')
  remove(@Db() db: SupabaseClient, @Param('accountId') accountId: string) {
    return this.cards.remove(db, accountId);
  }
}

/**
 * The scheduled catch-up, split out because it authenticates with the cron
 * secret instead of a user's JWT — see the `crons` entry in vercel.json.
 */
@UseGuards(CronGuard)
@Controller('credit-cards')
export class CreditCardsCronController {
  constructor(
    private readonly cards: CreditCardsService,
    private readonly supabase: SupabaseService,
  ) {}

  @Post('cron')
  cron() {
    return this.cards.runForAllUsers(this.supabase);
  }
}
