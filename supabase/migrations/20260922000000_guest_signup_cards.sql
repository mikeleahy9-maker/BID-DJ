create extension if not exists "pgcrypto";

alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_payment_method_id text;
alter table public.profiles add column if not exists card_brand text;
alter table public.profiles add column if not exists card_last4 text;
alter table public.profiles add column if not exists card_exp_month integer;
alter table public.profiles add column if not exists card_exp_year integer;