-- Divisor de Gastos Express — schema inicial

create extension if not exists "pgcrypto";

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) >= 2),
  currency text not null default 'ARS',
  is_closed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (group_id, name)
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  description text not null check (length(trim(description)) > 0),
  amount numeric(12,2) not null check (amount > 0),
  paid_by uuid not null references participants(id),
  created_at timestamptz not null default now()
);

create table if not exists expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  assigned_amount numeric(12,2) not null check (assigned_amount >= 0)
);

-- Validar que la suma de splits iguale el total del gasto
create or replace function check_splits_sum() returns trigger as $$
declare
  total numeric(12,2);
  sum_splits numeric(12,2);
begin
  select amount into total from expenses where id = coalesce(new.expense_id, old.expense_id);
  select coalesce(sum(assigned_amount), 0) into sum_splits
  from expense_splits where expense_id = coalesce(new.expense_id, old.expense_id);
  if abs(sum_splits - total) > 0.01 then
    raise exception 'La suma de los montos asignados (%) no coincide con el total del gasto (%)', sum_splits, total;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_check_splits_sum on expense_splits;
create constraint trigger trg_check_splits_sum
after insert or update or delete on expense_splits
deferrable initially deferred
for each row execute function check_splits_sum();

-- is_closed solo puede pasar de false a true
create or replace function prevent_reopen() returns trigger as $$
begin
  if old.is_closed = true and new.is_closed = false then
    raise exception 'No se puede reabrir un grupo cerrado';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_reopen on groups;
create trigger trg_prevent_reopen
before update on groups
for each row execute function prevent_reopen();

-- RLS
alter table groups enable row level security;
alter table participants enable row level security;
alter table expenses enable row level security;
alter table expense_splits enable row level security;

create policy "public read groups" on groups for select using (true);
create policy "public insert groups" on groups for insert with check (true);
create policy "public update groups" on groups for update using (true);

create policy "public read participants" on participants for select using (true);
create policy "public insert participants" on participants for insert with check (true);

create policy "public read expenses" on expenses for select using (true);
create policy "public insert expenses" on expenses for insert with check (true);
create policy "public update expenses" on expenses for update using (true);
create policy "public delete expenses" on expenses for delete using (true);

create policy "public read splits" on expense_splits for select using (true);
create policy "public insert splits" on expense_splits for insert with check (true);
create policy "public update splits" on expense_splits for update using (true);
create policy "public delete splits" on expense_splits for delete using (true);

-- Realtime
alter publication supabase_realtime add table groups;
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table expense_splits;
