import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCreditCardDto {
  @IsUUID() account_id!: string;
  @IsInt() @Min(1) @Max(31) statement_day!: number;
  @IsOptional() @IsInt() @Min(1) @Max(60) due_days_after?: number;
  @IsOptional() @IsNumber() @Min(0) credit_limit?: number;
  @IsOptional() @IsUUID() default_payment_account_id?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) min_due_pct?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) utilisation_alert_pct?: number;
  @IsOptional() @IsInt() @Min(0) @Max(30) reminder_days_before?: number;
}

export class UpdateCreditCardDto {
  @IsOptional() @IsInt() @Min(1) @Max(31) statement_day?: number;
  @IsOptional() @IsInt() @Min(1) @Max(60) due_days_after?: number;
  @IsOptional() @IsNumber() @Min(0) credit_limit?: number;
  @IsOptional() @IsUUID() default_payment_account_id?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) min_due_pct?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) utilisation_alert_pct?: number;
  @IsOptional() @IsInt() @Min(0) @Max(30) reminder_days_before?: number;
}

export class UpdateStatementDto {
  @IsOptional() @IsNumber() @Min(0) total_amount?: number;
  @IsOptional() @IsNumber() @Min(0) minimum_due?: number;
}

export class PayStatementDto {
  @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @IsUUID() from_account_id?: string;
  @IsOptional() @IsDateString() txn_date?: string;
}

export class CreateEmiPlanDto {
  @IsUUID() transaction_id!: string;
  @IsInt() @Min(1) @Max(120) tenure_months!: number;
  @IsOptional() @IsNumber() @Min(0) annual_rate?: number;
  /** Overrides the computed EMI when the bank quotes an exact figure. */
  @IsOptional() @IsNumber() @Min(0) emi_amount?: number;
  @IsOptional() @IsNumber() @Min(0) processing_fee?: number;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
}
