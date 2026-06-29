create table if not exists public.group_orders (
  id uuid primary key default gen_random_uuid(),
  shop_name text not null,
  meal_time text,
  deadline text,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  group_order_id uuid not null references public.group_orders(id) on delete cascade,
  name text not null,
  category text not null default '其他',
  price integer not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  group_order_id uuid not null references public.group_orders(id) on delete cascade,
  customer_name text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name text not null,
  category text not null default '其他',
  quantity integer not null,
  price integer not null,
  created_at timestamptz not null default now()
);

alter table public.group_orders enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "public read group orders"
on public.group_orders for select
using (true);

create policy "public create group orders"
on public.group_orders for insert
with check (true);

create policy "public read menu items"
on public.menu_items for select
using (true);

create policy "public create menu items"
on public.menu_items for insert
with check (true);

create policy "public read orders"
on public.orders for select
using (true);

create policy "public create orders"
on public.orders for insert
with check (true);

create policy "public read order items"
on public.order_items for select
using (true);

create policy "public create order items"
on public.order_items for insert
with check (true);
