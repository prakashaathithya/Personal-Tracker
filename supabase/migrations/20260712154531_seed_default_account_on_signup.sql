-- Extend the signup seed to give every new user a default cash account,
-- so transactions always have somewhere to post from day one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- profile row
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );

  -- default account
  insert into public.accounts (user_id, name, type)
  values (new.id, 'Cash', 'cash');

  -- default payment types (Excel DataCollection)
  insert into public.payment_types (user_id, name)
  values
    (new.id, 'Cash'),
    (new.id, 'UPI'),
    (new.id, 'Debit Card'),
    (new.id, 'Credit Card'),
    (new.id, 'EMI'),
    (new.id, 'Auto Debit');

  -- default categories with need classification (Excel DataCollection "Type")
  insert into public.categories (user_id, name, need_class)
  values
    (new.id, 'Salary', 'Others'),
    (new.id, 'Home', 'Needs'),
    (new.id, 'Home Rent', 'Needs'),
    (new.id, 'Groceries', 'Needs'),
    (new.id, 'Vegitables', 'Needs'),
    (new.id, 'EB', 'Needs'),
    (new.id, 'Cylinder', 'Needs'),
    (new.id, 'Wifi', 'Needs'),
    (new.id, 'Recharge', 'Needs'),
    (new.id, 'Maintenance', 'Needs'),
    (new.id, 'Medical', 'Needs'),
    (new.id, 'Health Insurance', 'Needs'),
    (new.id, 'Term Insurance', 'Needs'),
    (new.id, 'Car Insurance', 'Needs'),
    (new.id, 'LIC', 'Needs'),
    (new.id, 'Car Petrol', 'Needs'),
    (new.id, 'Bike Petrol', 'Needs'),
    (new.id, 'Fastag', 'Needs'),
    (new.id, 'Cab', 'Needs'),
    (new.id, 'Education', 'Needs'),
    (new.id, 'Electrician', 'Needs'),
    (new.id, 'Snacks', 'Wants'),
    (new.id, 'Food', 'Wants'),
    (new.id, 'Online-Food', 'Wants'),
    (new.id, 'Non-Veg', 'Wants'),
    (new.id, 'Entertainment', 'Wants'),
    (new.id, 'Outting', 'Wants'),
    (new.id, 'Travel', 'Wants'),
    (new.id, 'Dress', 'Wants'),
    (new.id, 'Online-Shopping', 'Wants'),
    (new.id, 'Offline-Shopping', 'Wants'),
    (new.id, 'Gift', 'Wants'),
    (new.id, 'OTT', 'Wants'),
    (new.id, 'Dry Fruits', 'Wants'),
    (new.id, 'Parking', 'Wants'),
    (new.id, 'AI Sub', 'Wants'),
    (new.id, 'Google', 'Wants'),
    (new.id, 'Laptop', 'Wants'),
    (new.id, 'Book', 'Wants'),
    (new.id, 'Self', 'Wants'),
    (new.id, 'RD', 'Saving'),
    (new.id, 'Gold Saving', 'Saving'),
    (new.id, 'GoldBees', 'Saving'),
    (new.id, 'Demat', 'Saving'),
    (new.id, 'Investment', 'Saving'),
    (new.id, 'AMC', 'Saving'),
    (new.id, 'Donation', 'Others'),
    (new.id, 'Temple', 'Others'),
    (new.id, 'EMI', 'Others'),
    (new.id, 'Borrow', 'Others'),
    (new.id, 'Bike', 'Others'),
    (new.id, 'Car', 'Others'),
    (new.id, 'Others', 'Others');

  return new;
end;
$function$;
