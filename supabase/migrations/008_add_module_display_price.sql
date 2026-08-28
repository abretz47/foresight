alter table public.training_modules
  add column if not exists display_price_cents integer,
  add column if not exists display_price_currency text;

alter table public.training_modules
  add constraint training_modules_display_price_cents_nonnegative
  check (display_price_cents is null or display_price_cents >= 0);

alter table public.training_modules
  add constraint training_modules_display_price_currency_format
  check (display_price_currency is null or display_price_currency ~ '^[A-Z]{3}$');
