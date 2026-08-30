import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { AccountsController } from './accounts/accounts.controller';
import { CategoriesController } from './categories/categories.controller';
import { PaymentTypesController } from './payment-types/payment-types.controller';
import { TransactionsController } from './transactions/transactions.controller';
import { ReportsController } from './reports/reports.controller';
import { BudgetItemsController } from './budgets/budget-items.controller';
import { MonthlyBudgetsController } from './budgets/monthly-budgets.controller';
import { LoansController } from './loans/loans.controller';
import { ImportController } from './import/import.controller';
import { RulesController } from './rules/rules.controller';
import { RecurringController } from './recurring/recurring.controller';
import { GoalsController } from './goals/goals.controller';
import {
  CreditCardsController,
  CreditCardsCronController,
} from './credit-cards/credit-cards.controller';
import { CreditCardsService } from './credit-cards/credit-cards.service';
import { NotificationsController } from './notifications/notifications.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Per-IP rate limit. The counter lives in the instance's memory, so on
    // Vercel each warm function holds its own tally and the effective limit
    // is a multiple of this — enough to blunt a script, not a precise quota.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
    }),
    SupabaseModule,
  ],
  controllers: [
    AppController,
    AccountsController,
    CategoriesController,
    PaymentTypesController,
    TransactionsController,
    ReportsController,
    BudgetItemsController,
    MonthlyBudgetsController,
    LoansController,
    ImportController,
    RulesController,
    RecurringController,
    GoalsController,
    CreditCardsCronController,
    CreditCardsController,
    NotificationsController,
  ],
  providers: [
    AppService,
    CreditCardsService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
