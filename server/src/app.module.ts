import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
  providers: [AppService],
})
export class AppModule {}
