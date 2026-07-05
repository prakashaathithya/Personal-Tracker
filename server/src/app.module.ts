import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { CategoriesController } from './categories/categories.controller';
import { PaymentTypesController } from './payment-types/payment-types.controller';
import { TransactionsController } from './transactions/transactions.controller';
import { ReportsController } from './reports/reports.controller';
import { BudgetItemsController } from './budgets/budget-items.controller';
import { MonthlyBudgetsController } from './budgets/monthly-budgets.controller';
import { LoansController } from './loans/loans.controller';
import { ImportController } from './import/import.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
  ],
  controllers: [
    AppController,
    CategoriesController,
    PaymentTypesController,
    TransactionsController,
    ReportsController,
    BudgetItemsController,
    MonthlyBudgetsController,
    LoansController,
    ImportController,
  ],
  providers: [AppService],
})
export class AppModule {}
